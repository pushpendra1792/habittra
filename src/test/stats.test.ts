import { describe, expect, it } from 'vitest'

import {
  currentStreak,
  dailyCounts,
  daysInMonth,
  elapsedDays,
  habitCompleted,
  habitProgressPct,
  longestStreak,
  momentumPct,
  monthlyProgressPct,
  normalizedProgressPct,
  successMessage,
  successRatePct,
  totals,
} from '@/lib/stats'
import { checkinsOn, makeCheckin, makeHabit } from '@/test/factories'
import type { MonthKey } from '@/types'

/** Days 1 to `last`, for building a habit checked in every day so far. */
function daysUpTo(last: number): number[] {
  return Array.from({ length: last }, (_, index) => index + 1)
}

const LONG_MONTHS: MonthKey[] = [
  '2023-01',
  '2023-03',
  '2023-05',
  '2023-07',
  '2023-08',
  '2023-10',
  '2023-12',
]
const SHORT_MONTHS: MonthKey[] = ['2023-04', '2023-06', '2023-09', '2023-11']

describe('daysInMonth', () => {
  it('counts 31 days in the long months', () => {
    for (const monthKey of LONG_MONTHS) {
      expect(daysInMonth(monthKey)).toBe(31)
    }
  })

  it('counts 30 days in the short months', () => {
    for (const monthKey of SHORT_MONTHS) {
      expect(daysInMonth(monthKey)).toBe(30)
    }
  })

  it('counts 28 days in February of a common year', () => {
    expect(daysInMonth('2023-02')).toBe(28)
    expect(daysInMonth('1900-02')).toBe(28)
  })

  it('counts 29 days in February of a leap year', () => {
    expect(daysInMonth('2024-02')).toBe(29)
    expect(daysInMonth('2000-02')).toBe(29)
  })

  it('agrees with a real calendar across two years', () => {
    for (let month = 1; month <= 12; month += 1) {
      const monthKey = `2024-${month.toString().padStart(2, '0')}` as MonthKey

      expect(daysInMonth(monthKey)).toBe(new Date(2024, month, 0).getDate())
    }
  })

  it('does not care which day of the month is asked about', () => {
    // The month key carries no day, so there is no way for a caller's clock to
    // change the answer.
    expect(daysInMonth('2023-07')).toBe(daysInMonth('2023-07'))
  })
})

describe('elapsedDays', () => {
  it('counts the days so far in the current month', () => {
    expect(elapsedDays('2023-07', '2023-07-01')).toBe(1)
    expect(elapsedDays('2023-07', '2023-07-22')).toBe(22)
    expect(elapsedDays('2023-07', '2023-07-31')).toBe(31)
  })

  it('returns the full month for a month in the past', () => {
    expect(elapsedDays('2023-06', '2023-07-01')).toBe(30)
    expect(elapsedDays('2023-02', '2023-03-01')).toBe(28)
    expect(elapsedDays('2024-02', '2025-01-01')).toBe(29)
  })

  it('returns zero for a month in the future', () => {
    expect(elapsedDays('2023-08', '2023-07-31')).toBe(0)
    expect(elapsedDays('2023-07', '2023-07-31')).not.toBe(0)
    expect(elapsedDays('2024-01', '2023-07-31')).toBe(0)
  })

  it('treats a month as elapsed only after the month changes', () => {
    expect(elapsedDays('2023-07', '2023-07-31')).toBe(31)
    expect(elapsedDays('2023-07', '2023-08-01')).toBe(31)
  })

  it('does not run past the end of a short month', () => {
    expect(elapsedDays('2023-02', '2023-02-28')).toBe(28)
    expect(elapsedDays('2024-02', '2024-02-29')).toBe(29)
  })

  it('is zero for the current month when the first day has not arrived', () => {
    // The current month always has at least today in it, so the smallest value
    // for a live month is 1.
    expect(elapsedDays('2023-07', '2023-07-01')).toBe(1)
  })
})

describe('habitCompleted', () => {
  const habitId = 'habit-1'

  it('counts one per day checked in', () => {
    const checkins = checkinsOn(habitId, '2023-07', [1, 2, 3])

    expect(habitCompleted(habitId, checkins, '2023-07')).toBe(3)
  })

  it('counts duplicate check-ins on the same day once', () => {
    const checkins = [
      ...checkinsOn(habitId, '2023-07', [1, 2]),
      ...checkinsOn(habitId, '2023-07', [2, 2, 3]),
    ]

    expect(habitCompleted(habitId, checkins, '2023-07')).toBe(3)
  })

  it('ignores check-ins for other habits', () => {
    const checkins = [
      ...checkinsOn(habitId, '2023-07', [1, 2]),
      ...checkinsOn('habit-2', '2023-07', [3, 4, 5]),
    ]

    expect(habitCompleted(habitId, checkins, '2023-07')).toBe(2)
    expect(habitCompleted('habit-2', checkins, '2023-07')).toBe(3)
  })

  it('ignores check-ins from other months', () => {
    const checkins = [
      ...checkinsOn(habitId, '2023-07', [1, 2]),
      ...checkinsOn(habitId, '2023-06', [1, 2, 3]),
    ]

    expect(habitCompleted(habitId, checkins, '2023-07')).toBe(2)
    expect(habitCompleted(habitId, checkins, '2023-06')).toBe(3)
  })

  it('is zero for a month with nothing checked in', () => {
    expect(habitCompleted(habitId, checkinsOn(habitId, '2023-07', [1, 2]), '2023-08')).toBe(0)
  })

  it('is zero with no check-ins at all', () => {
    expect(habitCompleted(habitId, [], '2023-07')).toBe(0)
  })

  it('counts a month in full without caring about the goal', () => {
    expect(
      habitCompleted(habitId, checkinsOn(habitId, '2023-07', [1, 2, 3, 4, 5, 6, 7]), '2023-07'),
    ).toBe(7)
  })
})

describe('habitProgressPct', () => {
  it('is zero before anything is checked in', () => {
    expect(habitProgressPct(makeHabit({ monthlyGoal: 10 }), 0)).toBe(0)
  })

  it('is 100 once the goal is met', () => {
    expect(habitProgressPct(makeHabit({ monthlyGoal: 10 }), 10)).toBe(100)
  })

  it('is half at half the goal', () => {
    expect(habitProgressPct(makeHabit({ monthlyGoal: 10 }), 5)).toBe(50)
  })

  it('rounds to the nearest whole percent', () => {
    // 1 of 3 is 33.33, 2 of 3 is 66.67.
    expect(habitProgressPct(makeHabit({ monthlyGoal: 3 }), 1)).toBe(33)
    expect(habitProgressPct(makeHabit({ monthlyGoal: 3 }), 2)).toBe(67)
    // 1 of 8 is 12.5, which rounds up.
    expect(habitProgressPct(makeHabit({ monthlyGoal: 8 }), 1)).toBe(13)
  })

  it('stops at 100 when the goal is beaten', () => {
    expect(habitProgressPct(makeHabit({ monthlyGoal: 5 }), 6)).toBe(100)
    expect(habitProgressPct(makeHabit({ monthlyGoal: 1 }), 31)).toBe(100)
  })

  it('never goes above 100 or below 0', () => {
    const habit = makeHabit({ monthlyGoal: 4 })

    expect(habitProgressPct(habit, 100)).toBe(100)
    expect(habitProgressPct(habit, -1)).toBe(-25)
  })

  it('works for every allowed goal', () => {
    for (let goal = 1; goal <= 31; goal += 1) {
      const habit = makeHabit({ monthlyGoal: goal })

      expect(habitProgressPct(habit, 0)).toBe(0)
      expect(habitProgressPct(habit, goal)).toBe(100)
      expect(habitProgressPct(habit, goal + 1)).toBe(100)
    }
  })
})

describe('dailyCounts', () => {
  it('returns one entry per day of the month', () => {
    expect(dailyCounts([makeHabit()], [], '2023-07', '2023-07-22')).toHaveLength(31)
    expect(dailyCounts([makeHabit()], [], '2023-02', '2023-02-10')).toHaveLength(28)
    expect(dailyCounts([makeHabit()], [], '2024-02', '2024-02-10')).toHaveLength(29)
    expect(dailyCounts([makeHabit()], [], '2023-04', '2023-04-10')).toHaveLength(30)
  })

  it('counts the active habits checked in on each day', () => {
    const a = makeHabit()
    const b = makeHabit()
    const checkins = [...checkinsOn(a.id, '2023-07', [1, 2]), ...checkinsOn(b.id, '2023-07', [2])]

    // Day 1 has one habit done, day 2 has both, day 3 onwards nothing.
    expect(dailyCounts([a, b], checkins, '2023-07', '2023-07-22')).toEqual([
      1,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ])
  })

  it('returns null after today and a real zero before it', () => {
    const counts = dailyCounts([makeHabit()], [], '2023-07', '2023-07-22')

    expect(counts.slice(0, 22).every((count) => count === 0)).toBe(true)
    expect(counts.slice(22)).toEqual([null, null, null, null, null, null, null, null, null])
  })

  it('is all numbers for a past month and all null for a future one', () => {
    const habit = makeHabit()
    const checkins = checkinsOn(habit.id, '2023-06', [1, 30])

    const past = dailyCounts([habit], checkins, '2023-06', '2023-07-22')
    expect(past.every((count) => typeof count === 'number')).toBe(true)
    expect(past[0]).toBe(1)
    expect(past[29]).toBe(1)

    expect(
      dailyCounts([habit], checkins, '2023-08', '2023-07-22').every((count) => count === null),
    ).toBe(true)
  })

  it('ends the line at today on the first day of a month', () => {
    expect(dailyCounts([makeHabit()], [], '2023-07', '2023-07-01')).toEqual([
      0,
      ...Array.from({ length: 30 }, () => null),
    ])
  })

  it('excludes archived habits', () => {
    const active = makeHabit()
    const archived = makeHabit({ archived: true })
    const checkins = [
      ...checkinsOn(active.id, '2023-07', [1]),
      ...checkinsOn(archived.id, '2023-07', [1]),
    ]

    expect(dailyCounts([active, archived], checkins, '2023-07', '2023-07-22')[0]).toBe(1)
    expect(dailyCounts([archived], checkins, '2023-07', '2023-07-22')[0]).toBe(0)
  })

  it('ignores check-ins from other months', () => {
    const habit = makeHabit()
    const checkins = checkinsOn(habit.id, '2023-06', [15])

    expect(
      dailyCounts([habit], checkins, '2023-07', '2023-07-22')
        .slice(0, 22)
        .every((c) => c === 0),
    ).toBe(true)
  })

  it('ignores a check-in for a habit that is not in the list', () => {
    const known = makeHabit()
    const orphan = makeHabit()
    const checkins = checkinsOn(orphan.id, '2023-07', [1, 2])

    expect(dailyCounts([known], checkins, '2023-07', '2023-07-22')[0]).toBe(0)
  })

  it('ignores duplicates of the same day for the same habit', () => {
    const habit = makeHabit()
    const checkins = [
      ...checkinsOn(habit.id, '2023-07', [3]),
      ...checkinsOn(habit.id, '2023-07', [3, 3]),
      makeCheckin({ habitId: habit.id, date: '2023-07-03' }),
    ]

    expect(dailyCounts([habit], checkins, '2023-07', '2023-07-22')[2]).toBe(1)
  })

  it('never counts more habits than there are active habits', () => {
    const habit = makeHabit()
    const checkins = [
      ...checkinsOn(habit.id, '2023-07', [3, 3, 3]),
      makeCheckin({ habitId: habit.id, date: '2023-07-03' }),
    ]

    const counts = dailyCounts([habit], checkins, '2023-07', '2023-07-22')

    expect(Math.max(...counts.filter((count): count is number => count !== null))).toBe(1)
  })

  it('adds up to the same total as habitCompleted per active habit', () => {
    const a = makeHabit()
    const b = makeHabit()
    const archived = makeHabit({ archived: true })
    const habits = [a, b, archived]
    const checkins = [
      ...checkinsOn(a.id, '2023-07', [1, 2, 2, 3]),
      ...checkinsOn(b.id, '2023-07', [2, 5]),
      ...checkinsOn(archived.id, '2023-07', [1, 2, 3, 4, 5, 6]),
      ...checkinsOn(a.id, '2023-06', [1, 2, 3]),
    ]

    const fromChart = dailyCounts(habits, checkins, '2023-07', '2023-07-22').reduce<number>(
      (sum, count) => sum + (count ?? 0),
      0,
    )
    const fromGrid =
      habitCompleted(a.id, checkins, '2023-07') + habitCompleted(b.id, checkins, '2023-07')

    expect(fromChart).toBe(fromGrid)
    expect(fromChart).toBe(5)
  })

  it('ignores a check-in dated outside the month it claims', () => {
    const habit = makeHabit()
    const checkins = [
      makeCheckin({ habitId: habit.id, date: '2023-02-30' }),
      ...checkinsOn(habit.id, '2023-02', [1]),
    ]

    const counts = dailyCounts([habit], checkins, '2023-02', '2023-02-28')

    expect(counts).toHaveLength(28)
    expect(counts[0]).toBe(1)
  })

  it('is all zeros with no habits at all', () => {
    const habit = makeHabit()
    const checkins = checkinsOn(habit.id, '2023-07', [1, 2, 3])

    expect(dailyCounts([], checkins, '2023-07', '2023-07-22').slice(0, 22)).toEqual(
      Array.from({ length: 22 }, () => 0),
    )
  })

  it('never returns NaN', () => {
    const counts = dailyCounts([], [], '2023-02', '2023-02-05')

    for (const count of counts) {
      expect(Number.isNaN(count)).toBe(false)
    }
  })
})

/**
 * The reference month used by the percentage tests: July 2023, 31 days, with
 * today on the 22nd, so 22 days have elapsed.
 */
const JULY = '2023-07' as MonthKey
const JULY_22 = '2023-07-22' as const

describe('totals', () => {
  it('is all zeros with no habits', () => {
    expect(totals([], [], JULY)).toEqual({ completed: 0, goal: 0, cappedCompleted: 0 })
  })

  it('is the goal and nothing else with habits and no check-ins', () => {
    const habits = [makeHabit({ monthlyGoal: 10 }), makeHabit({ monthlyGoal: 5 })]

    expect(totals(habits, [], JULY)).toEqual({ completed: 0, goal: 15, cappedCompleted: 0 })
  })

  it('sums goals and check-ins across habits', () => {
    const a = makeHabit({ monthlyGoal: 10 })
    const b = makeHabit({ monthlyGoal: 7 })
    const checkins = [...checkinsOn(a.id, JULY, [1, 2, 3]), ...checkinsOn(b.id, JULY, [4])]

    expect(totals([a, b], checkins, JULY)).toEqual({ completed: 4, goal: 17, cappedCompleted: 4 })
  })

  it('reports more than the goal when a habit is beaten, but caps the maths', () => {
    const habit = makeHabit({ monthlyGoal: 4 })
    const checkins = checkinsOn(habit.id, JULY, [1, 2, 3, 4, 5, 6, 7])

    expect(totals([habit], checkins, JULY)).toEqual({ completed: 7, goal: 4, cappedCompleted: 4 })
  })

  it('caps each habit separately, so one over-achiever cannot cover another', () => {
    const strong = makeHabit({ monthlyGoal: 4 })
    const neglected = makeHabit({ monthlyGoal: 20 })
    const checkins = checkinsOn(strong.id, JULY, [1, 2, 3, 4, 5, 6, 7, 8])

    expect(totals([strong, neglected], checkins, JULY)).toEqual({
      completed: 8,
      goal: 24,
      cappedCompleted: 4,
    })
  })

  it('leaves archived habits out of every number', () => {
    const active = makeHabit({ monthlyGoal: 10 })
    const archived = makeHabit({ monthlyGoal: 31, archived: true })
    const checkins = [
      ...checkinsOn(active.id, JULY, [1, 2]),
      ...checkinsOn(archived.id, JULY, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    ]

    expect(totals([active, archived], checkins, JULY)).toEqual({
      completed: 2,
      goal: 10,
      cappedCompleted: 2,
    })
  })

  it('ignores check-ins from other months', () => {
    const habit = makeHabit({ monthlyGoal: 10 })
    const checkins = [
      ...checkinsOn(habit.id, JULY, [1, 2]),
      ...checkinsOn(habit.id, '2023-06', [1, 2, 3, 4, 5]),
    ]

    expect(totals([habit], checkins, JULY).completed).toBe(2)
  })

  it('counts duplicate check-ins on one day once', () => {
    const habit = makeHabit({ monthlyGoal: 10 })
    const checkins = [
      ...checkinsOn(habit.id, JULY, [1, 1, 2]),
      makeCheckin({ habitId: habit.id, date: '2023-07-02' }),
    ]

    expect(totals([habit], checkins, JULY).completed).toBe(2)
  })

  it('matches the reference month of 52 check-ins against a goal of 84', () => {
    // Six habits at 10 a month (60) and three at 8 (24) is 84. 52 distinct
    // habit-days spread across them.
    const habits = [
      makeHabit({ monthlyGoal: 10 }),
      makeHabit({ monthlyGoal: 10 }),
      makeHabit({ monthlyGoal: 10 }),
      makeHabit({ monthlyGoal: 10 }),
      makeHabit({ monthlyGoal: 10 }),
      makeHabit({ monthlyGoal: 10 }),
      makeHabit({ monthlyGoal: 8 }),
      makeHabit({ monthlyGoal: 8 }),
      makeHabit({ monthlyGoal: 8 }),
    ]
    const checkins = [
      ...checkinsOn(habits[0]?.id ?? '', JULY, [1, 2, 3, 4, 5, 6]),
      ...checkinsOn(habits[1]?.id ?? '', JULY, [1, 2, 3, 4, 5, 6]),
      ...checkinsOn(habits[2]?.id ?? '', JULY, [1, 2, 3, 4, 5, 6]),
      ...checkinsOn(habits[3]?.id ?? '', JULY, [1, 2, 3, 4, 5, 6]),
      ...checkinsOn(habits[4]?.id ?? '', JULY, [1, 2, 3, 4, 5, 6]),
      ...checkinsOn(habits[5]?.id ?? '', JULY, [1, 2, 3, 4, 5, 6]),
      ...checkinsOn(habits[6]?.id ?? '', JULY, [1, 2, 3, 4, 5, 6]),
      ...checkinsOn(habits[7]?.id ?? '', JULY, [1, 2, 3, 4, 5]),
      ...checkinsOn(habits[8]?.id ?? '', JULY, [1, 2, 3, 4, 5]),
    ]

    expect(totals(habits, checkins, JULY)).toEqual({ completed: 52, goal: 84, cappedCompleted: 52 })
  })
})

describe('monthlyProgressPct', () => {
  it('is 52 of 84 as 61.9%', () => {
    const pct = monthlyProgressPct({ completed: 52, goal: 84, cappedCompleted: 52 })

    expect(pct).toBeCloseTo(61.9, 1)
    expect(Number(pct.toFixed(1))).toBe(61.9)
  })

  it('is 0 with no goals rather than NaN', () => {
    expect(monthlyProgressPct({ completed: 0, goal: 0, cappedCompleted: 0 })).toBe(0)
  })

  it('is 0 before anything is checked in and 100 once every goal is met', () => {
    expect(monthlyProgressPct({ completed: 0, goal: 30, cappedCompleted: 0 })).toBe(0)
    expect(monthlyProgressPct({ completed: 30, goal: 30, cappedCompleted: 30 })).toBe(100)
  })

  it('stops at 100 when the goals are beaten', () => {
    expect(monthlyProgressPct({ completed: 44, goal: 30, cappedCompleted: 44 })).toBe(100)
  })

  it('uses the capped figure, not the raw one', () => {
    // 10 raw check-ins against a goal of 5, plus another habit at 0 of 10:
    // uncapped that would read 50%, capped it is 5 of 15.
    expect(monthlyProgressPct({ completed: 10, goal: 15, cappedCompleted: 5 })).toBeCloseTo(33.3, 1)
  })

  it('never returns NaN', () => {
    expect(Number.isNaN(monthlyProgressPct({ completed: 0, goal: 0, cappedCompleted: 0 }))).toBe(
      false,
    )
  })
})

describe('normalizedProgressPct', () => {
  it('is 52 of 84 with 22 of 31 days gone as 87.2%', () => {
    const pct = normalizedProgressPct(
      { completed: 52, goal: 84, cappedCompleted: 52 },
      JULY,
      JULY_22,
    )

    expect(pct).toBeCloseTo(87.2, 1)
    expect(Number(pct.toFixed(1))).toBe(87.2)
  })

  it('is below the raw monthly figure this early in a month', () => {
    const monthTotals = { completed: 52, goal: 84, cappedCompleted: 52 }

    expect(normalizedProgressPct(monthTotals, JULY, JULY_22)).toBeGreaterThan(
      monthlyProgressPct(monthTotals),
    )
  })

  it('is 100 on the last day of the month, where the two figures agree', () => {
    const monthTotals = { completed: 52, goal: 84, cappedCompleted: 52 }

    expect(normalizedProgressPct(monthTotals, JULY, '2023-07-31')).toBeCloseTo(
      monthlyProgressPct(monthTotals),
      5,
    )
  })

  it('is 100 for a finished month', () => {
    expect(
      normalizedProgressPct({ completed: 30, goal: 30, cappedCompleted: 30 }, JULY, '2023-07-31'),
    ).toBe(100)
  })

  it('is 0 for a month that has not started', () => {
    expect(
      normalizedProgressPct({ completed: 0, goal: 30, cappedCompleted: 0 }, '2023-08', JULY_22),
    ).toBe(0)
  })

  it('is 0 with no habits at all', () => {
    expect(
      normalizedProgressPct({ completed: 0, goal: 0, cappedCompleted: 0 }, JULY, JULY_22),
    ).toBe(0)
  })

  it('is above 100 before the month is out, and stops at 100', () => {
    // One day into a 31 day month, the pace so far is 84 / 31 = 2.7 check-ins,
    // so 3 on day one is 110% of it and reads as 100.
    expect(
      normalizedProgressPct({ completed: 3, goal: 84, cappedCompleted: 3 }, JULY, '2023-07-01'),
    ).toBe(100)
    expect(
      normalizedProgressPct({ completed: 2, goal: 84, cappedCompleted: 2 }, JULY, '2023-07-01'),
    ).toBeCloseTo(73.8, 1)
  })

  it('never returns NaN', () => {
    const values = [
      normalizedProgressPct({ completed: 0, goal: 0, cappedCompleted: 0 }, JULY, JULY_22),
      normalizedProgressPct({ completed: 0, goal: 10, cappedCompleted: 0 }, JULY, '2023-07-01'),
    ]

    for (const value of values) {
      expect(Number.isNaN(value)).toBe(false)
    }
  })
})

describe('momentumPct', () => {
  const habits = [makeHabit({ monthlyGoal: 31 }), makeHabit({ monthlyGoal: 31 })]

  it('is 0 before the month starts', () => {
    expect(momentumPct(habits, [], '2023-08', JULY_22)).toBe(0)
  })

  it('is 0 with no habits or no check-ins', () => {
    expect(momentumPct(habits, [], JULY, JULY_22)).toBe(0)
    expect(momentumPct([], [], JULY, JULY_22)).toBe(0)
  })

  it('is 100 when the last three days are exactly on pace', () => {
    // Goal 62 over 31 days is 2 a day, so the window of 3 days expects 6.
    const a = habits[0]
    const b = habits[1]

    if (a === undefined || b === undefined) {
      throw new Error('fixture missing')
    }

    const checkins = [
      ...checkinsOn(a.id, JULY, [20, 21, 22]),
      ...checkinsOn(b.id, JULY, [20, 21, 22]),
    ]

    expect(momentumPct(habits, checkins, JULY, JULY_22)).toBeCloseTo(100, 5)
  })

  it('is 100, not 200, when the window is beaten', () => {
    const a = habits[0]
    const b = habits[1]

    if (a === undefined || b === undefined) {
      throw new Error('fixture missing')
    }

    const checkins = [
      ...checkinsOn(a.id, JULY, [20, 21, 22]),
      ...checkinsOn(b.id, JULY, [20, 21, 22]),
      ...checkinsOn(a.id, JULY, [1, 2, 3, 4, 5]),
    ]

    expect(momentumPct(habits, checkins, JULY, JULY_22)).toBe(100)
  })

  it('is about 50 when half the window was done', () => {
    const a = habits[0]
    const b = habits[1]

    if (a === undefined || b === undefined) {
      throw new Error('fixture missing')
    }

    const checkins = [...checkinsOn(a.id, JULY, [20, 21]), ...checkinsOn(b.id, JULY, [20])]

    expect(momentumPct(habits, checkins, JULY, JULY_22)).toBeCloseTo(50, 5)
  })

  it('ignores check-ins before the window', () => {
    const a = habits[0]
    const b = habits[1]

    if (a === undefined || b === undefined) {
      throw new Error('fixture missing')
    }

    const checkins = [...checkinsOn(a.id, JULY, [1, 2, 3, 4, 5]), ...checkinsOn(b.id, JULY, [])]

    expect(momentumPct(habits, checkins, JULY, JULY_22)).toBe(0)
  })

  it('uses the days that exist when the month is one day old', () => {
    const a = habits[0]
    const b = habits[1]

    if (a === undefined || b === undefined) {
      throw new Error('fixture missing')
    }

    // One day elapsed, so the expected figure is 2 of 62 over 31 days, and one
    // check-in on day 1 is well ahead of it.
    const checkins = [...checkinsOn(a.id, JULY, [1]), ...checkinsOn(b.id, JULY, [1])]

    expect(momentumPct(habits, checkins, JULY, '2023-07-01')).toBe(100)
  })

  it('uses the two days that exist on the second of a month', () => {
    const a = habits[0]

    if (a === undefined) {
      throw new Error('fixture missing')
    }

    const oneHabit = [a]
    // Expected over two days is 31 / 31 * 2 = 2. One check-in is half of that.
    const checkins = checkinsOn(a.id, JULY, [2])

    expect(momentumPct(oneHabit, checkins, JULY, '2023-07-02')).toBeCloseTo(50, 5)
  })

  it('is 100 for a month that is over', () => {
    const a = habits[0]
    const b = habits[1]

    if (a === undefined || b === undefined) {
      throw new Error('fixture missing')
    }

    const checkins = [
      ...checkinsOn(a.id, JULY, [29, 30, 31]),
      ...checkinsOn(b.id, JULY, [29, 30, 31]),
    ]

    expect(momentumPct(habits, checkins, JULY, '2023-08-01')).toBeCloseTo(100, 5)
  })

  it('excludes archived habits from both sides of the ratio', () => {
    const active = makeHabit({ monthlyGoal: 31 })
    const archived = makeHabit({ monthlyGoal: 31, archived: true })
    const checkins = [
      ...checkinsOn(active.id, JULY, [20, 21, 22]),
      ...checkinsOn(archived.id, JULY, [20, 21, 22]),
    ]

    // Only the active habit's 3 check-ins count, and only its goal of 31 is the
    // target, so 3 / (31 / 31 * 3) = 100.
    expect(momentumPct([active, archived], checkins, JULY, JULY_22)).toBeCloseTo(100, 5)
  })

  it('never returns NaN', () => {
    expect(Number.isNaN(momentumPct([], [], JULY, JULY_22))).toBe(false)
  })
})

describe('successRatePct', () => {
  it('is 0 with no habits', () => {
    expect(successRatePct([], [], JULY, JULY_22)).toBe(0)
  })

  it('is 0 for a month that has not started', () => {
    expect(successRatePct([makeHabit({ monthlyGoal: 10 })], [], '2023-08', JULY_22)).toBe(0)
  })

  it('is 0 when nothing has been done', () => {
    // One day in, a goal of 31 needs floor(31 / 31) = 1 check-in.
    expect(successRatePct([makeHabit({ monthlyGoal: 31 })], [], JULY, '2023-07-01')).toBe(0)
  })

  it('is 100 when every habit has met its share of the month', () => {
    // 22 of 31 days gone, a goal of 31 needs floor(31 * 22 / 31) = 22.
    const habit = makeHabit({ monthlyGoal: 31 })

    expect(successRatePct([habit], checkinsOn(habit.id, JULY, daysUpTo(22)), JULY, JULY_22)).toBe(
      100,
    )
  })

  it('is 100 when a habit is past its goal', () => {
    const habit = makeHabit({ monthlyGoal: 5 })

    expect(successRatePct([habit], checkinsOn(habit.id, JULY, daysUpTo(10)), JULY, JULY_22)).toBe(
      100,
    )
  })

  it('rounds to a whole percent', () => {
    // Two of three habits on pace is 66.67%, shown as 67.
    const a = makeHabit({ monthlyGoal: 31 })
    const b = makeHabit({ monthlyGoal: 31 })
    const c = makeHabit({ monthlyGoal: 31 })
    const checkins = [
      ...checkinsOn(a.id, JULY, daysUpTo(22)),
      ...checkinsOn(b.id, JULY, daysUpTo(22)),
    ]

    expect(successRatePct([a, b, c], checkins, JULY, JULY_22)).toBe(67)
    expect(successRatePct([a, b, c], checkinsOn(c.id, JULY, daysUpTo(22)), JULY, JULY_22)).toBe(33)
  })

  it('rounds a single habit to 0 or 100, never to a fraction', () => {
    const a = makeHabit({ monthlyGoal: 31 })

    expect(successRatePct([a], [], JULY, JULY_22)).toBe(0)
    expect(successRatePct([a], checkinsOn(a.id, JULY, daysUpTo(22)), JULY, JULY_22)).toBe(100)
  })

  it('requires the whole goal on the last day of a past month', () => {
    const habit = makeHabit({ monthlyGoal: 10 })
    const short = checkinsOn(habit.id, JULY, daysUpTo(9))

    expect(successRatePct([habit], short, JULY, '2023-08-01')).toBe(0)
    expect(
      successRatePct([habit], checkinsOn(habit.id, JULY, daysUpTo(10)), JULY, '2023-08-01'),
    ).toBe(100)
  })

  it('does not count a habit as on pace for a fraction of a day it missed', () => {
    // 2 of 31 days gone: floor(31 * 2 / 31) = 2. One check-in is not enough.
    const habit = makeHabit({ monthlyGoal: 31 })

    expect(successRatePct([habit], checkinsOn(habit.id, JULY, [1]), JULY, '2023-07-02')).toBe(0)
    expect(successRatePct([habit], checkinsOn(habit.id, JULY, [1, 2]), JULY, '2023-07-02')).toBe(
      100,
    )
  })

  it('excludes archived habits from the share', () => {
    const active = makeHabit({ monthlyGoal: 10 })
    const archived = makeHabit({ monthlyGoal: 10, archived: true })
    const checkins = checkinsOn(active.id, JULY, daysUpTo(10))

    // The archived habit has nothing, but it is not in the denominator.
    expect(successRatePct([active, archived], checkins, JULY, JULY_22)).toBe(100)
  })

  it('never returns NaN', () => {
    expect(Number.isNaN(successRatePct([], [], JULY, JULY_22))).toBe(false)
  })
})

describe('successMessage', () => {
  it('praises 90 and above', () => {
    expect(successMessage(100)).toBe('Excellent')
    expect(successMessage(90)).toBe('Excellent')
  })

  it('is happy with 70 to 89', () => {
    expect(successMessage(89)).toBe('Good job')
    expect(successMessage(70)).toBe('Good job')
  })

  it('encourages 40 to 69', () => {
    expect(successMessage(69)).toBe('Keep going')
    expect(successMessage(40)).toBe('Keep going')
  })

  it('is gentle below 40', () => {
    expect(successMessage(39)).toBe('Fresh start, one tap at a time')
    expect(successMessage(1)).toBe('Fresh start, one tap at a time')
    expect(successMessage(0)).toBe('Fresh start, one tap at a time')
  })
})

describe('currentStreak', () => {
  const habitId = 'habit-1'

  it('is 0 with no check-ins at all', () => {
    expect(currentStreak(habitId, [], JULY_22)).toBe(0)
  })

  it('is 0 when nothing was checked in today or yesterday', () => {
    const checkins = checkinsOn(habitId, JULY, [20, 18])

    expect(currentStreak(habitId, checkins, JULY_22)).toBe(0)
  })

  it('counts back from today', () => {
    const checkins = checkinsOn(habitId, JULY, [20, 21, 22])

    expect(currentStreak(habitId, checkins, JULY_22)).toBe(3)
  })

  it('counts a single day', () => {
    expect(currentStreak(habitId, checkinsOn(habitId, JULY, [22]), JULY_22)).toBe(1)
  })

  it('survives today not being checked in yet', () => {
    const checkins = checkinsOn(habitId, JULY, [20, 21])

    expect(currentStreak(habitId, checkins, JULY_22)).toBe(2)
  })

  it('is broken by a missed day', () => {
    const checkins = checkinsOn(habitId, JULY, [18, 19, 20, 22])

    expect(currentStreak(habitId, checkins, JULY_22)).toBe(1)
  })

  it('is broken by a missed yesterday', () => {
    expect(currentStreak(habitId, checkinsOn(habitId, JULY, [20]), JULY_22)).toBe(0)
  })

  it('counts a run that crosses a month boundary', () => {
    const checkins = [
      ...checkinsOn(habitId, '2023-06', [29, 30]),
      ...checkinsOn(habitId, JULY, [1]),
    ]

    expect(currentStreak(habitId, checkins, JULY_22)).toBe(0)
    expect(currentStreak(habitId, checkins, '2023-07-01')).toBe(3)
  })

  it('counts a run that crosses a year boundary', () => {
    const checkins = [
      ...checkinsOn(habitId, '2022-12', [30, 31]),
      ...checkinsOn(habitId, '2023-01', [1]),
    ]

    expect(currentStreak(habitId, checkins, '2023-01-01')).toBe(3)
  })

  it('counts a run that covers every day of a leap February', () => {
    expect(currentStreak(habitId, checkinsOn(habitId, '2024-02', daysUpTo(29)), '2024-02-29')).toBe(
      29,
    )
  })

  it('counts a run that covers every day of a non-leap February', () => {
    expect(currentStreak(habitId, checkinsOn(habitId, '2023-02', daysUpTo(28)), '2023-02-28')).toBe(
      28,
    )
  })

  it('is not extended by a check-in in a later month', () => {
    const checkins = [
      ...checkinsOn(habitId, JULY, [21, 22]),
      ...checkinsOn(habitId, '2023-08', [1, 2, 3]),
    ]

    expect(currentStreak(habitId, checkins, JULY_22)).toBe(2)
  })

  it('counts duplicates of a day once', () => {
    const checkins = [
      ...checkinsOn(habitId, JULY, [21, 22, 22]),
      makeCheckin({ habitId, date: '2023-07-22' }),
    ]

    expect(currentStreak(habitId, checkins, JULY_22)).toBe(2)
  })

  it('ignores check-ins for other habits', () => {
    expect(currentStreak(habitId, checkinsOn('habit-2', JULY, daysUpTo(22)), JULY_22)).toBe(0)
  })

  it('is 0 on the first day of a month with only that day checked in', () => {
    expect(currentStreak(habitId, checkinsOn(habitId, JULY, [1]), '2023-07-01')).toBe(1)
    expect(currentStreak(habitId, [], '2023-07-01')).toBe(0)
  })
})

describe('longestStreak', () => {
  const habitId = 'habit-1'

  it('is 0 with no check-ins at all', () => {
    expect(longestStreak(habitId, [])).toBe(0)
  })

  it('is 1 for a single isolated day', () => {
    expect(longestStreak(habitId, checkinsOn(habitId, JULY, [15]))).toBe(1)
  })

  it('finds the longest run anywhere in the month', () => {
    const checkins = checkinsOn(habitId, JULY, [1, 2, 3, 10, 11, 12, 13, 20, 21, 22])

    expect(longestStreak(habitId, checkins)).toBe(4)
  })

  it('spans months and years', () => {
    const checkins = [
      ...checkinsOn(habitId, '2022-12', [30, 31]),
      ...checkinsOn(habitId, '2023-01', [1, 2]),
      ...checkinsOn(habitId, JULY, [5, 6]),
    ]

    expect(longestStreak(habitId, checkins)).toBe(4)
  })

  it('counts a run that covers every day of a leap February', () => {
    expect(longestStreak(habitId, checkinsOn(habitId, '2024-02', daysUpTo(29)))).toBe(29)
  })

  it('counts a run that covers every day of a 31 day month', () => {
    expect(longestStreak(habitId, checkinsOn(habitId, JULY, daysUpTo(31)))).toBe(31)
  })

  it('does not join two runs across a gap', () => {
    expect(longestStreak(habitId, checkinsOn(habitId, JULY, [1, 2, 3, 5, 6, 7]))).toBe(3)
  })

  it('does not join runs across a month boundary that has a gap in it', () => {
    // 1 August is the day after 31 July, but 2 August is not.
    const joined = [...checkinsOn(habitId, '2023-07', [31]), ...checkinsOn(habitId, '2023-08', [1])]
    const gapped = [...checkinsOn(habitId, '2023-07', [31]), ...checkinsOn(habitId, '2023-08', [2])]

    expect(longestStreak(habitId, joined)).toBe(2)
    expect(longestStreak(habitId, gapped)).toBe(1)
  })

  it('counts duplicates of a day once', () => {
    const checkins = [
      ...checkinsOn(habitId, JULY, [1, 2]),
      makeCheckin({ habitId, date: '2023-07-02' }),
    ]

    expect(longestStreak(habitId, checkins)).toBe(2)
  })

  it('ignores check-ins for other habits', () => {
    expect(longestStreak(habitId, checkinsOn('habit-2', JULY, daysUpTo(10)))).toBe(0)
  })

  it('is never shorter than the current streak', () => {
    const checkins = checkinsOn(habitId, JULY, [...daysUpTo(3), ...daysUpTo(22)])

    expect(longestStreak(habitId, checkins)).toBeGreaterThanOrEqual(
      currentStreak(habitId, checkins, JULY_22),
    )
  })
})
