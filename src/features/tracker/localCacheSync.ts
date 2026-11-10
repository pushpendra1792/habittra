/**
 * The bridge between TanStack Query and IndexedDB.
 *
 * Hydration fills the query cache before the page mounts, so the tracker paints
 * from the last session and then asks Supabase for a fresh copy. Persistence
 * watches the same cache, which means optimistic writes are saved without any
 * component having to remember to call a storage function.
 */
import type { QueryClient } from '@tanstack/react-query'

import { checkinsKey, habitListKey } from '@/features/tracker/trackerQueries'
import type { Checkin, Habit, MonthKey } from '@/types'

import {
  readAllCachedCheckins,
  readCachedHabits,
  writeCachedCheckins,
  writeCachedHabits,
} from '@/lib/sync/localCache'

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/

/** Copies this user's cached habits and months into the query cache. */
export async function hydrateTrackerCache(queryClient: QueryClient, userId: string): Promise<void> {
  const [habits, months] = await Promise.all([
    readCachedHabits(userId),
    readAllCachedCheckins(userId),
  ])

  if (habits !== null) {
    queryClient.setQueryData(habitListKey, habits)
  }

  for (const month of months) {
    queryClient.setQueryData(checkinsKey(month.monthKey), month.checkins)
  }

  // The cached copy is good enough to paint, but it is stale by definition.
  // Marking it invalid makes mounted queries refresh in the background; a
  // failed refresh leaves the cached data in place.
  void queryClient.invalidateQueries({ queryKey: habitListKey })

  for (const month of months) {
    void queryClient.invalidateQueries({ queryKey: checkinsKey(month.monthKey) })
  }
}

/**
 * Saves every later habit or check-in cache update.
 *
 * Writes are chained so an optimistic tap cannot be overwritten by an older
 * network response that happened to finish its IndexedDB write second.
 */
export function persistTrackerCache(queryClient: QueryClient, userId: string): () => void {
  let writes: Promise<void> = Promise.resolve()

  const save = (write: () => Promise<void>) => {
    writes = writes.then(write).catch((error: unknown) => {
      if (import.meta.env.DEV) {
        console.error('[offline] could not save local cache', error)
      }
    })
  }

  return queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated') {
      return
    }

    const { query } = event
    const data: unknown = query.state.data

    if (data === undefined) {
      return
    }

    const queryKey = query.queryKey as readonly unknown[]
    const [kind, second] = queryKey

    if (kind === 'habits' && queryKey.length === 1 && Array.isArray(data)) {
      save(() => writeCachedHabits(userId, data as Habit[]))
      return
    }

    if (
      kind === 'checkins' &&
      typeof second === 'string' &&
      MONTH_KEY.test(second) &&
      Array.isArray(data)
    ) {
      const monthKey = second as MonthKey

      save(() => writeCachedCheckins(userId, monthKey, data as Checkin[]))
    }
  })
}
