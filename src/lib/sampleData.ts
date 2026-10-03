/**
 * Demo data for tests and for the /design review page. Never for a real user.
 *
 * Everything here is invented: the owner is not a real account, the ids are
 * fixed strings with no UUID behind them, and the timestamps are constants. The
 * one thing it must stay honest about is shape, because the statistics in
 * `@/lib/stats` run over it, so a demo that lies about its own fields would
 * hide a bug in the place a reviewer is most likely to look.
 *
 * Nothing outside this file and the test setup may import it. A signed-in user
 * reads their own rows or sees an empty state; they never see this.
 */
import type { AccentName } from '@/lib/accents'
import type { Checkin, DateString, Habit, MonthKey } from '@/types'

/** The month the demo data covers: July 2023, 31 days. */
export const SAMPLE_MONTH = '2023-07' as MonthKey

/** The demo "today", so the /design page shows a finished month, not a live one. */
export const SAMPLE_TODAY = '2023-07-22' as DateString

/** Day of the month the demo data stops at, inclusive. */
export const SAMPLE_LAST_DAY = 22

const SAMPLE_USER_ID = 'user-sample'

interface SampleHabit {
  name: string
  monthlyGoal: number
  /** Checked on these days of the sample month. */
  days: readonly number[]
}

/**
 * The nine demo habits, in the order they appear on screen, which is also the
 * order of the accent cycle: teal, blue, purple, yellow, coral, then round again.
 *
 * The goals are what a person could plausibly set for a month, and the days are
 * picked to look like a real month rather than a grid: strong habits are nearly
 * done, one is behind, one was only just started, and one is missed more often
 * than not.
 */
const HABIT_SPECS: readonly SampleHabit[] = [
  {
    name: 'Stretch or do yoga',
    monthlyGoal: 5,
    days: [1, 3, 5, 8, 12, 16, 20, 21],
  },
  {
    name: 'Walk 10,000 steps',
    monthlyGoal: 10,
    days: [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 18, 20, 22],
  },
  {
    name: 'Read a book chapter',
    monthlyGoal: 15,
    days: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 21],
  },
  {
    name: 'Declutter a space',
    monthlyGoal: 4,
    days: [3, 9, 16, 21],
  },
  { name: 'Floss', monthlyGoal: 20, days: [2, 4, 6, 8, 10, 14, 16, 18, 21] },
  { name: 'Play a guitar', monthlyGoal: 10, days: [1, 4, 7, 11, 14, 17, 19, 21] },
  { name: 'Call grandpa', monthlyGoal: 10, days: [7, 14, 21] },
  {
    name: 'Volunteer',
    monthlyGoal: 3,
    days: [15, 21],
  },
  { name: 'Put $10 to savings', monthlyGoal: 10, days: [5, 10, 15, 20, 21] },
]

/** The accent cycle, in the order the demo habits use it. */
const SAMPLE_COLORS: readonly AccentName[] = [
  'teal',
  'blue',
  'purple',
  'yellow',
  'coral',
  'teal',
  'blue',
  'purple',
  'yellow',
]

/** Fixed creation timestamps. `YYYY-MM` plus a day and a time, zero padded. */
function createdAt(day: number, hours: number): string {
  return `2023-07-${day.toString().padStart(2, '0')}T${hours.toString().padStart(2, '0')}:00:00.000Z`
}

function makeSampleHabit(habit: SampleHabit, index: number): Habit {
  return {
    id: `sample-habit-${(index + 1).toString().padStart(2, '0')}`,
    userId: SAMPLE_USER_ID,
    name: habit.name,
    monthlyGoal: habit.monthlyGoal,
    // Non-null because the list and the colour cycle are edited together, and
    // the type system cannot see that they line up.
    color: SAMPLE_COLORS[index] ?? 'teal',
    sortOrder: index,
    archived: false,
    createdAt: createdAt(index + 1, 8),
  }
}

function makeSampleCheckin(
  habitId: string,
  day: number,
  index: number,
  sortOrder: number,
): Checkin {
  return {
    id: `sample-checkin-${sortOrder.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
    habitId,
    userId: SAMPLE_USER_ID,
    date: `${SAMPLE_MONTH}-${day.toString().padStart(2, '0')}` as DateString,
    createdAt: createdAt(day, 8 + (index % 8)),
  }
}

/** The nine demo habits, in screen order, none archived. */
export const SAMPLE_HABITS: readonly Habit[] = HABIT_SPECS.map(makeSampleHabit)

/**
 * The check-ins for the sample month, up to and including the 22nd.
 *
 * Built once at module load from a fixed list, so every import sees the same
 * records and a test cannot be affected by another test changing them. One row
 * per habit per day, so nothing here is a duplicate of anything.
 */
export const SAMPLE_CHECKINS: readonly Checkin[] = SAMPLE_HABITS.flatMap((habit, index) =>
  (HABIT_SPECS[index]?.days ?? []).map((day, dayIndex) =>
    makeSampleCheckin(habit.id, day, dayIndex, habit.sortOrder),
  ),
)
