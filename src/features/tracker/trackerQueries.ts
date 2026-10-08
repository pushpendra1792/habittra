/**
 * The tracker's read side: one hook per query, and the keys that name them.
 *
 * Hooks live here, away from the components, so Phase 6 can wrap the same keys
 * with an offline queue or a sync layer without touching a single row of the
 * grid. Components never see a key and never call Supabase: they call these.
 */
import { useQuery } from '@tanstack/react-query'

import { orderHabits } from '@/features/habits/habitList'
import { listCheckinsForMonth } from '@/lib/api/checkinsApi'
import { listHabits } from '@/lib/api/habitsApi'
import type { MonthKey } from '@/types'

/** One key for every habit this user has, archived ones included. */
export const habitListKey = ['habits'] as const

/** One key per month, so switching months never refetches the month before. */
export function checkinsKey(monthKey: MonthKey): readonly ['checkins', MonthKey] {
  return ['checkins', monthKey]
}

/**
 * This user's habits, always in list order.
 *
 * `select` applies `orderHabits` rather than leaving it to each caller: the
 * server already sorts, but an optimistic create or reorder writes to the cache
 * first and the fetch arrives after, and every screen has to agree on the order
 * in between.
 */
export function useHabits() {
  return useQuery({
    queryKey: habitListKey,
    queryFn: listHabits,
    select: orderHabits,
  })
}

/** This user's check-ins for the month on screen. */
export function useCheckins(monthKey: MonthKey) {
  return useQuery({
    queryKey: checkinsKey(monthKey),
    queryFn: () => listCheckinsForMonth(monthKey),
  })
}
