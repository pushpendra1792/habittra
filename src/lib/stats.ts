/**
 * The statistics behind every number the app shows.
 *
 * Two rules hold throughout. First, a check-in belongs to the calendar day the
 * user lived, so membership of a month is decided by string prefix on
 * `YYYY-MM-DD` and never by converting to UTC. Second, a habit that is done
 * more often than its goal is capped before it is added to a total, so one
 * strong habit cannot make a neglected one look finished.
 *
 * Every function is pure: same inputs, same output, no clock and no fetch.
 * "Now" always arrives as an argument, which is what makes them testable.
 */
import type { Checkin, DateString, Habit, MonthKey } from '@/types'

/** Days in the momentum window: the last three elapsed days. */
export const MOMENTUM_WINDOW_DAYS = 3

/**
 * Whole days in a month. January through June are 31, July through November 30,
 * December 31, February 28 except in a leap year.
 *
 * Derived from a local `Date` set to midnight on the first of the month, then
 * moved back one day, because that is the last day of the month before. A leap
 * year is the only case where February answers 29: the rule is year % 4 === 0
 * and (year % 100 !== 0 or year % 400 === 0), applied by the engine rather
 * than reimplemented here.
 */
export function daysInMonth(monthKey: MonthKey): number {
  const [yearText, monthText] = monthKey.split('-')
  const firstOfNextMonth = new Date(Number(yearText), Number(monthText), 1)

  // Day 0 of the next month is the last day of this one. getDate() on a local
  // Date, so no timezone can move it.
  firstOfNextMonth.setDate(0)

  return firstOfNextMonth.getDate()
}

/**
 * Days of the month that have already happened, counted against `today`:
 *
 *   month before today's month -> daysInMonth(monthKey)   (it is over)
 *   month equal to today's     -> day of month of today  (1 to 31)
 *   month after today's month  -> 0                     (it has not started)
 *
 * Comparing the `YYYY-MM` prefixes as strings is enough, because zero padded
 * months sort in calendar order.
 */
export function elapsedDays(monthKey: MonthKey, today: DateString): number {
  const todayMonth = today.slice(0, 7)

  if (monthKey < todayMonth) {
    return daysInMonth(monthKey)
  }

  if (monthKey > todayMonth) {
    return 0
  }

  const dayOfMonth = Number(today.slice(8, 10))

  return Math.min(dayOfMonth, daysInMonth(monthKey))
}

/**
 * Distinct days checked in for one habit within a month.
 *
 * Duplicates of the same day count once:  check-ins are deduped per habit by a
 * unique constraint in the database, but a race or an import could still leave
 * two rows for one day, and the count has to match what the grid shows.
 * Check-ins in any other month are ignored.
 */
export function habitCompleted(
  habitId: string,
  checkins: readonly Checkin[],
  monthKey: MonthKey,
): number {
  const days = new Set<DateString>()

  for (const checkin of checkins) {
    if (checkin.habitId === habitId && checkin.date.startsWith(monthKey)) {
      days.add(checkin.date)
    }
  }

  return days.size
}

/**
 * How far one habit has got toward its monthly goal, 0 to 100:
 *
 *   min(100, round(completed / monthlyGoal * 100))
 *
 * Capped, not just clamped, because a habit with more check-ins than its goal
 * is done and a bar that kept filling past the end would be a lie.
 */
export function habitProgressPct(habit: Habit, completed: number): number {
  return Math.min(100, Math.round((completed / habit.monthlyGoal) * 100))
}

/**
 * One entry per day of the month: how many active habits were checked in that
 * day, which is the height of the trend chart.
 *
 *   counts[d - 1] = active habits checked in on day d, one count per habit
 *
 * A habit contributes at most 1 to a day, so duplicate rows for the same habit
 * and day do not stack. Days after today are `null`, not 0. A zero would draw a
 * dip into the future and would read as failure; null ends the line at today.
 * Days that have passed with nothing done are a real 0 and stay on the chart.
 */
export function dailyCounts(
  habits: readonly Habit[],
  checkins: readonly Checkin[],
  monthKey: MonthKey,
  today: DateString,
): (number | null)[] {
  const total = daysInMonth(monthKey)
  const elapsed = elapsedDays(monthKey, today)
  const activeHabitIds = new Set(habits.filter((habit) => !habit.archived).map((habit) => habit.id))

  const counts = new Map<number, number>()
  // Keyed by habit and day, so a duplicate row cannot make one habit look like
  // two. That keeps the chart consistent with the grid: adding up the counts has
  // to give the same total as adding up habitCompleted per habit.
  const seen = new Set<string>()

  for (const checkin of checkins) {
    if (!activeHabitIds.has(checkin.habitId) || !checkin.date.startsWith(monthKey)) {
      continue
    }

    const dayOfMonth = Number(checkin.date.slice(8, 10))

    // Guards a malformed row rather than the normal case: a bad date must not
    // land a count on the wrong day, or on an index outside the array.
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > total) {
      continue
    }

    const key = `${checkin.habitId} ${dayOfMonth}`

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    counts.set(dayOfMonth, (counts.get(dayOfMonth) ?? 0) + 1)
  }

  return Array.from({ length: total }, (_, index) => {
    const dayOfMonth = index + 1

    return dayOfMonth <= elapsed ? (counts.get(dayOfMonth) ?? 0) : null
  })
}
