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
import { clampPercent } from '@/lib/numbers'
import type { Checkin, DateString, Habit, MonthKey } from '@/types'

/** Days in the momentum window: the last three elapsed days. */
export const MOMENTUM_WINDOW_DAYS = 3

/** Active habits only. Archived ones keep their history and leave every total. */
function activeHabits(habits: readonly Habit[]): Habit[] {
  return habits.filter((habit) => !habit.archived)
}

function activeHabitIds(habits: readonly Habit[]): Set<string> {
  return new Set(activeHabits(habits).map((habit) => habit.id))
}

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
 * Duplicates of the same day count once: check-ins are deduped per habit by a
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
 * Day of month to the set of active habits checked in on that day, for one
 * month only. Each habit appears at most once per day, so a duplicate row for
 * the same habit and day cannot make one habit look like two. Shared by the
 * chart and the momentum window so the two cannot disagree.
 */
function habitsByDay(
  checkins: readonly Checkin[],
  activeIds: ReadonlySet<string>,
  monthKey: MonthKey,
): Map<number, Set<string>> {
  const total = daysInMonth(monthKey)
  const byDay = new Map<number, Set<string>>()
  const seen = new Set<string>()

  for (const checkin of checkins) {
    if (!activeIds.has(checkin.habitId) || !checkin.date.startsWith(monthKey)) {
      continue
    }

    const dayOfMonth = Number(checkin.date.slice(8, 10))

    // Guards a malformed row rather than the normal case: a bad date must not
    // land a count on the wrong day, or on a day the month does not have.
    if (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > total) {
      continue
    }

    const key = `${checkin.habitId} ${dayOfMonth}`

    if (seen.has(key)) {
      continue
    }

    seen.add(key)

    const habits = byDay.get(dayOfMonth) ?? new Set<string>()

    habits.add(checkin.habitId)
    byDay.set(dayOfMonth, habits)
  }

  return byDay
}

/**
 * One entry per day of the month: how many active habits were checked in that
 * day, which is the height of the trend chart.
 *
 *   counts[d - 1] = active habits checked in on day d, one count per habit
 *
 * Adding up the entries gives the same total as adding up habitCompleted for
 * each active habit, so the chart and the grid cannot disagree.
 *
 * Days after today are `null`, not 0. A zero would draw a dip into the future
 * and would read as failure; null ends the line at today. Days that have passed
 * with nothing done are a real 0 and stay on the chart.
 */
export function dailyCounts(
  habits: readonly Habit[],
  checkins: readonly Checkin[],
  monthKey: MonthKey,
  today: DateString,
): (number | null)[] {
  const total = daysInMonth(monthKey)
  const elapsed = elapsedDays(monthKey, today)
  const byDay = habitsByDay(checkins, activeHabitIds(habits), monthKey)

  return Array.from({ length: total }, (_, index) => {
    const dayOfMonth = index + 1

    return dayOfMonth <= elapsed ? (byDay.get(dayOfMonth)?.size ?? 0) : null
  })
}

export interface Totals {
  /**
   * Check-ins across active habits, uncapped. This is the "X/Y Completed"
   * number, so a habit beaten by three shows as 13, not 10. It is not used in
   * any percentage.
   */
  completed: number
  /** Sum of monthlyGoal across active habits. Zero when there are no habits. */
  goal: number
  /**
   * Sum over active habits of min(completed, monthlyGoal). Every percentage is
   * built from this, never from `completed`.
   *
   * The reason is that percentages of raw totals flatter the user in exactly
   * the case that matters. A habit checked every day against a goal of 4 puts
   * in 28 check-ins and can carry a second habit that has never been checked
   * once past 70%. Capping each habit at its own goal keeps a surplus on one
   * habit from hiding a neglected one, so the score means "how many of the
   * promises you made are you keeping".
   */
  cappedCompleted: number
}

/**
 * The month's totals over active habits. Archived habits are left out
 * completely: their check-ins do not count and their goals do not inflate the
 * target.
 *
 *   goal            = sum of monthlyGoal
 *   completed       = sum of habitCompleted                     (for display)
 *   cappedCompleted = sum of min(habitCompleted, monthlyGoal)   (for maths)
 */
export function totals(
  habits: readonly Habit[],
  checkins: readonly Checkin[],
  monthKey: MonthKey,
): Totals {
  let completed = 0
  let goal = 0
  let cappedCompleted = 0

  for (const habit of habits) {
    if (habit.archived) {
      continue
    }

    const habitTotal = habitCompleted(habit.id, checkins, monthKey)

    completed += habitTotal
    goal += habit.monthlyGoal
    cappedCompleted += Math.min(habitTotal, habit.monthlyGoal)
  }

  return { completed, goal, cappedCompleted }
}

/**
 * Progress against the goals of the whole month, as a percentage:
 *
 *   cappedCompleted / goal * 100
 *
 * Capped at 100, since that is the end of the ring and the end of the bar. No
 * rounding is applied, so a caller can show one decimal: 52 of 84 is 61.9%.
 * Returns 0 rather than 0/0 when there are no active habits.
 */
export function monthlyProgressPct(monthTotals: Totals): number {
  if (monthTotals.goal === 0) {
    return 0
  }

  return clampPercent((monthTotals.cappedCompleted / monthTotals.goal) * 100)
}

/**
 * Progress against the part of the month that has already happened:
 *
 *   cappedCompleted / (goal * elapsedDays / daysInMonth) * 100
 *
 * The denominator is the goal scaled by how much of the month is gone, so this
 * answers "am I keeping up" rather than "am I finished". With 52 of 84 done and
 * 22 of 31 days gone that is 52 / (84 * 22 / 31) = 87.2%, where the raw monthly
 * figure says 61.9% and reads like a failure on the 22nd.
 *
 * Capped at 100 for the same reason as the monthly figure: a month cannot be
 * more than done. Returns 0 when no days have elapsed, meaning the month has
 * not started, and 0 when there is no goal to scale.
 */
export function normalizedProgressPct(
  monthTotals: Totals,
  monthKey: MonthKey,
  today: DateString,
): number {
  const elapsed = elapsedDays(monthKey, today)

  if (elapsed === 0) {
    return 0
  }

  const expected = (monthTotals.goal * elapsed) / daysInMonth(monthKey)

  if (expected === 0) {
    return 0
  }

  return clampPercent((monthTotals.cappedCompleted / expected) * 100)
}

/**
 * Momentum over the last few days, as a percentage of what was expected then:
 *
 *   recent / expected * 100,  where
 *   recent   = check-ins on active habits inside the window
 *   expected = goal / daysInMonth * daysInTheWindow
 *
 * The window is the last three elapsed days, ending on today inclusive. On a
 * month one or two days old the window shrinks to the days that exist, so there
 * is still something to divide by. Both sides scale with the same days, which is
 * the point: this asks whether the user is speeding up, slowing down or holding
 * steady, and it is the number that moves week to week.
 *
 * Capped at 100, because being ahead is all the credit it needs to give.
 * Returns 0 when no days have elapsed or there is no goal.
 */
export function momentumPct(
  habits: readonly Habit[],
  checkins: readonly Checkin[],
  monthKey: MonthKey,
  today: DateString,
): number {
  const elapsed = elapsedDays(monthKey, today)

  if (elapsed === 0) {
    return 0
  }

  const daysInWindow = Math.min(MOMENTUM_WINDOW_DAYS, elapsed)
  const firstDayOfWindow = elapsed - daysInWindow + 1
  const byDay = habitsByDay(checkins, activeHabitIds(habits), monthKey)
  const goal = totals(habits, checkins, monthKey).goal
  const expected = (goal / daysInMonth(monthKey)) * daysInWindow

  if (expected === 0) {
    return 0
  }

  let recent = 0

  for (let day = firstDayOfWindow; day <= elapsed; day += 1) {
    recent += byDay.get(day)?.size ?? 0
  }

  return clampPercent((recent / expected) * 100)
}

/**
 * The share of active habits that are keeping pace, as a rounded whole percent.
 *
 * A habit is on pace when it has at least as many check-ins as the part of its
 * goal that the elapsed days account for:
 *
 *   completed >= floor(monthlyGoal * elapsedDays / daysInMonth)
 *
 * floor, not round, so a habit is never called on pace for a fraction of a day
 * it has not done yet. On the last day of the month the requirement is the whole
 * goal, and a habit already past its goal is on pace by definition.
 *
 * Returns 0 when there are no active habits, and also when no days have elapsed:
 * nothing has happened yet, and scoring a month that has not started as 100% on
 * pace would be a score nobody earned. No rounding happens per habit, only on
 * the final share.
 */
export function successRatePct(
  habits: readonly Habit[],
  checkins: readonly Checkin[],
  monthKey: MonthKey,
  today: DateString,
): number {
  const active = activeHabits(habits)
  const elapsed = elapsedDays(monthKey, today)

  if (active.length === 0 || elapsed === 0) {
    return 0
  }

  const total = daysInMonth(monthKey)
  let onPace = 0

  for (const habit of active) {
    const required = Math.floor((habit.monthlyGoal * elapsed) / total)

    if (habitCompleted(habit.id, checkins, monthKey) >= required) {
      onPace += 1
    }
  }

  return Math.round((onPace / active.length) * 100)
}

/**
 * The headline under the success rate. Each band is inclusive at the bottom, so
 * 90 is Excellent and 89 is Good job.
 */
export function successMessage(pct: number): string {
  if (pct >= 90) {
    return 'Excellent'
  }

  if (pct >= 70) {
    return 'Good job'
  }

  if (pct >= 40) {
    return 'Keep going'
  }

  return 'Fresh start, one tap at a time'
}
