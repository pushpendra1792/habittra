import { describe, expect, it } from 'vitest'

import { checkinsOn, makeHabit } from '@/test/factories'
import type { DateString, MonthKey } from '@/types'
import { barHeightPct, dailyPoints, formatOneDecimal, recentCountWindow } from './chartModel'
import { mapMonthStats } from './monthStats'

const JULY = '2023-07' as MonthKey
const AUGUST = '2023-08' as MonthKey
const TODAY = '2023-07-22' as DateString

function julyFixture() {
  const run = makeHabit({ name: 'Run', monthlyGoal: 10 })
  const read = makeHabit({ name: 'Read', monthlyGoal: 5 })

  return {
    habits: [run, read],
    checkins: [
      ...checkinsOn(run.id, JULY, [1, 2, 3, 4, 5]),
      ...checkinsOn(read.id, JULY, [1, 2, 3, 4, 5, 6, 20, 21]),
    ],
  }
}

describe('mapMonthStats', () => {
  it('wires every dashboard number to the Phase 2 result', () => {
    const { habits, checkins } = julyFixture()
    const stats = mapMonthStats(habits, checkins, JULY, TODAY)

    expect(stats.monthKey).toBe(JULY)
    expect(stats.year).toBe(2023)
    expect(stats.totals).toEqual({ completed: 13, goal: 15, cappedCompleted: 10 })
    expect(stats.monthlyProgressPct).toBeCloseTo((10 / 15) * 100, 6)
    expect(stats.normalizedProgressPct).toBeCloseTo((10 / ((15 * 22) / 31)) * 100, 6)
    expect(stats.momentumPct).toBe(100)
    expect(stats.successRatePct).toBe(50)
    expect(stats.successMessage).toBe('Keep going')
    expect(stats.elapsedDays).toBe(22)
    expect(stats.daysInMonth).toBe(31)
    expect(stats.startDate).toBe('2023-07-01')
    expect(stats.endDate).toBe('2023-07-31')
    expect(stats.hasActiveHabits).toBe(true)
    expect(stats.isFuture).toBe(false)
  })

  it('keeps real zero days and null future days in the daily counts', () => {
    const { habits, checkins } = julyFixture()
    const counts = mapMonthStats(habits, checkins, JULY, TODAY).dailyCounts

    expect(counts).toHaveLength(31)
    expect(counts.slice(0, 6)).toEqual([2, 2, 2, 2, 2, 1])
    expect(counts[6]).toBe(0)
    expect(counts[18]).toBe(0)
    expect(counts[19]).toBe(1)
    expect(counts[20]).toBe(1)
    expect(counts[21]).toBe(0)
    expect(counts.slice(22)).toEqual(Array.from({ length: 9 }, () => null))
  })

  it('uses the whole month once every day has elapsed', () => {
    const { habits, checkins } = julyFixture()
    const stats = mapMonthStats(habits, checkins, JULY, '2023-08-10')

    expect(stats.elapsedDays).toBe(31)
    expect(stats.dailyCounts).toHaveLength(31)
    expect(stats.dailyCounts).not.toContain(null)
  })

  it('returns honest zeros, not NaN, when there are no active habits', () => {
    const archived = makeHabit({ archived: true })
    const stats = mapMonthStats([archived], [], JULY, TODAY)

    expect(stats.totals).toEqual({ completed: 0, goal: 0, cappedCompleted: 0 })
    expect(stats.monthlyProgressPct).toBe(0)
    expect(stats.normalizedProgressPct).toBe(0)
    expect(stats.momentumPct).toBe(0)
    expect(stats.successRatePct).toBe(0)
    expect(stats.maxDailyCount).toBe(0)
    expect(stats.hasActiveHabits).toBe(false)

    for (const value of [
      stats.monthlyProgressPct,
      stats.normalizedProgressPct,
      stats.momentumPct,
      stats.successRatePct,
    ]) {
      expect(Number.isNaN(value)).toBe(false)
    }
  })

  it('marks a future month and leaves every day null', () => {
    const habit = makeHabit({ monthlyGoal: 10 })
    const stats = mapMonthStats([habit], [], AUGUST, TODAY)

    expect(stats.elapsedDays).toBe(0)
    expect(stats.daysInMonth).toBe(31)
    expect(stats.startDate).toBe('2023-08-01')
    expect(stats.endDate).toBe('2023-08-31')
    expect(stats.dailyCounts).toEqual(Array.from({ length: 31 }, () => null))
    expect(stats.maxDailyCount).toBe(0)
    expect(stats.monthlyProgressPct).toBe(0)
    expect(stats.normalizedProgressPct).toBe(0)
    expect(stats.momentumPct).toBe(0)
    expect(stats.successRatePct).toBe(0)
    expect(stats.hasActiveHabits).toBe(true)
    expect(stats.isFuture).toBe(true)
  })
})

describe('dailyPoints', () => {
  it('marks the first highest day and keeps future values null', () => {
    const points = dailyPoints([0, 3, null, 3, 1])

    expect(points).toEqual([
      { day: 1, value: 0, isMax: false },
      { day: 2, value: 3, isMax: true },
      { day: 3, value: null, isMax: false },
      { day: 4, value: 3, isMax: false },
      { day: 5, value: 1, isMax: false },
    ])
  })

  it('starts at an offset for the mobile window', () => {
    const points = dailyPoints([1, 2], 9)

    expect(points.map((point) => point.day)).toEqual([9, 10])
  })

  it('does not highlight anything when every point is zero', () => {
    expect(dailyPoints([0, 0, 0]).some((point) => point.isMax)).toBe(false)
  })
})

describe('recentCountWindow', () => {
  const counts = Array.from({ length: 31 }, (_, index) => index + 1)

  it('takes the last 14 elapsed days near the end of the month', () => {
    const window = recentCountWindow(counts, 22)

    expect(window.counts).toHaveLength(14)
    expect(window.startDay).toBe(9)
    expect(window.counts[0]).toBe(9)
    expect(window.counts[13]).toBe(22)
  })

  it('never reaches into future days early in the month', () => {
    const window = recentCountWindow(counts, 5)

    expect(window.counts).toHaveLength(5)
    expect(window.startDay).toBe(1)
    expect(window.counts[4]).toBe(5)
  })

  it('is empty for a future month and tolerates a zero window', () => {
    expect(recentCountWindow(counts, 0)).toEqual({ counts: [], startDay: 1 })
    expect(recentCountWindow(counts, 22, 0)).toEqual({ counts: [], startDay: 23 })
  })
})

describe('barHeightPct', () => {
  it('scales a checked day against the busiest one', () => {
    expect(barHeightPct(5, 10)).toBe(50)
    expect(barHeightPct(10, 10)).toBe(100)
  })

  it('gives a quiet but real day a visible minimum', () => {
    expect(barHeightPct(1, 100)).toBe(8)
  })

  it('draws nothing for zero, null, or an empty scale', () => {
    expect(barHeightPct(0, 10)).toBe(0)
    expect(barHeightPct(null, 10)).toBe(0)
    expect(barHeightPct(5, 0)).toBe(0)
  })
})

describe('formatOneDecimal', () => {
  it('always shows one decimal', () => {
    expect(formatOneDecimal(61.94)).toBe('61.9')
    expect(formatOneDecimal(100)).toBe('100.0')
    expect(formatOneDecimal(0)).toBe('0.0')
  })
})
