import { describe, expect, it } from 'vitest'

import {
  dailyCounts,
  daysInMonth,
  elapsedDays,
  habitCompleted,
  habitProgressPct,
} from '@/lib/stats'
import { checkinsOn, makeCheckin, makeHabit } from '@/test/factories'
import type { MonthKey } from '@/types'

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
