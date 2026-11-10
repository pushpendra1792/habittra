/**
 * The dashboard's read side.
 *
 * It deliberately calls the same `useHabits` / `useCheckins` hooks the grid
 * uses, which means the same TanStack Query keys. There is no dashboard-only
 * query and therefore no second request and no loading flash when the summary
 * appears: the optimistic check-in cache update is already visible to both.
 */
import { useCallback, useMemo } from 'react'

import { useCheckins, useHabits } from '@/features/tracker/trackerQueries'
import { todayString } from '@/lib/dates'
import type { Checkin, DateString, Habit, MonthKey } from '@/types'
import { mapMonthStats, type MonthStats } from './monthStats'

const NO_HABITS: Habit[] = []
const NO_CHECKINS: Checkin[] = []

export interface UseMonthStatsResult extends MonthStats {
  /** Raw rows, so the page can hand the grid the same data it summarised. */
  habits: Habit[]
  checkins: Checkin[]
  /** The local calendar day the summary was computed for. */
  today: DateString
  isPending: boolean
  isError: boolean
  /** Refetches only the query or queries that failed. */
  retry: () => void
}

export function useMonthStats(monthKey: MonthKey): UseMonthStatsResult {
  const habitsQuery = useHabits()
  const checkinsQuery = useCheckins(monthKey)
  const today = todayString()

  const habits = habitsQuery.data ?? NO_HABITS
  const checkins = checkinsQuery.data ?? NO_CHECKINS

  const stats = useMemo(
    () => mapMonthStats(habits, checkins, monthKey, today),
    [habits, checkins, monthKey, today],
  )

  // A failed background refresh is not a failed tracker. When IndexedDB has
  // already supplied the month, the failed request must leave that copy on
  // screen; only a query with no data at all is allowed to become an error
  // panel. Otherwise opening the app offline would hide everything it just
  // hydrated.
  const habitsFailed = habitsQuery.isError && habitsQuery.data === undefined
  const checkinsFailed = checkinsQuery.isError && checkinsQuery.data === undefined
  const refetchHabits = habitsQuery.refetch
  const refetchCheckins = checkinsQuery.refetch

  const retry = useCallback(() => {
    if (habitsFailed) {
      void refetchHabits()
    }

    if (checkinsFailed) {
      void refetchCheckins()
    }
  }, [checkinsFailed, habitsFailed, refetchCheckins, refetchHabits])

  return {
    ...stats,
    habits,
    checkins,
    today,
    isPending: habitsQuery.isPending || checkinsQuery.isPending,
    isError: habitsFailed || checkinsFailed,
    retry,
  }
}
