/**
 * The dashboard's numbers, all taken from `@/lib/stats`.
 *
 * This file does no arithmetic of its own beyond wiring the Phase 2 functions
 * together. A number shown on the dashboard has exactly one definition, and
 * that definition lives in `stats.ts`.
 */
import {
  dailyCounts,
  daysInMonth,
  elapsedDays,
  momentumPct,
  monthlyProgressPct,
  normalizedProgressPct,
  successMessage,
  successRatePct,
  totals,
  type Totals,
} from '@/lib/stats'
import type { Checkin, DateString, Habit, MonthKey } from '@/types'

export interface MonthStats {
  monthKey: MonthKey
  /** Calendar year, from the month key. */
  year: number
  totals: Totals
  /** One entry per day: `null` after today, `0` for a real day with no check-ins. */
  dailyCounts: (number | null)[]
  /** Highest non-null daily count, used to scale the bar strip. */
  maxDailyCount: number
  monthlyProgressPct: number
  normalizedProgressPct: number
  momentumPct: number
  successRatePct: number
  successMessage: string
  elapsedDays: number
  daysInMonth: number
  startDate: DateString
  endDate: DateString
  /** False when every habit is archived or the list is empty. */
  hasActiveHabits: boolean
  /** True when no day of the month has happened yet. */
  isFuture: boolean
}

/** Highest non-null daily count, or 0 when nothing has happened yet. */
export function maxDailyCount(counts: readonly (number | null)[]): number {
  let max = 0

  for (const count of counts) {
    if (count !== null && count > max) {
      max = count
    }
  }

  return max
}

/**
 * Every number the dashboard shows, for one month and one "today".
 *
 * No clock is read here: `today` is always an argument, which keeps the result
 * deterministic and lets the empty and future-month cases be tested directly.
 */
export function mapMonthStats(
  habits: readonly Habit[],
  checkins: readonly Checkin[],
  monthKey: MonthKey,
  today: DateString,
): MonthStats {
  const monthTotals = totals(habits, checkins, monthKey)
  const success = successRatePct(habits, checkins, monthKey, today)
  const counts = dailyCounts(habits, checkins, monthKey, today)
  const elapsed = elapsedDays(monthKey, today)
  const totalDays = daysInMonth(monthKey)
  const [yearText] = monthKey.split('-')

  return {
    monthKey,
    year: Number(yearText),
    totals: monthTotals,
    dailyCounts: counts,
    maxDailyCount: maxDailyCount(counts),
    monthlyProgressPct: monthlyProgressPct(monthTotals),
    normalizedProgressPct: normalizedProgressPct(monthTotals, monthKey, today),
    momentumPct: momentumPct(habits, checkins, monthKey, today),
    successRatePct: success,
    successMessage: successMessage(success),
    elapsedDays: elapsed,
    daysInMonth: totalDays,
    startDate: `${monthKey}-01` as DateString,
    endDate: `${monthKey}-${String(totalDays).padStart(2, '0')}` as DateString,
    hasActiveHabits: monthTotals.goal > 0,
    isFuture: elapsed === 0,
  }
}
