import { describe, expect, it } from 'vitest'

import { parseDateString } from '@/lib/dates'
import {
  SAMPLE_CHECKINS,
  SAMPLE_HABITS,
  SAMPLE_LAST_DAY,
  SAMPLE_MONTH,
  SAMPLE_TODAY,
} from '@/lib/sampleData'
import {
  currentStreak,
  dailyCounts,
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
import { HABIT_NAME_MAX_LENGTH, MONTHLY_GOAL_MAX, MONTHLY_GOAL_MIN } from '@/types'

describe('sample data', () => {
  it('has the nine demo habits in order, with the goals it claims', () => {
    expect(SAMPLE_HABITS.map((habit) => habit.name)).toEqual([
      'Stretch or do yoga',
      'Walk 10,000 steps',
      'Read a book chapter',
      'Declutter a space',
      'Floss',
      'Play a guitar',
      'Call grandpa',
      'Volunteer',
      'Put $10 to savings',
    ])

    expect(SAMPLE_HABITS.map((habit) => habit.monthlyGoal)).toEqual([
      5, 10, 15, 4, 20, 10, 10, 3, 10,
    ])
  })

  it('stays inside the domain rules', () => {
    const ids = new Set<string>()

    for (const habit of SAMPLE_HABITS) {
      expect(habit.name.length).toBeGreaterThanOrEqual(1)
      expect(habit.name.length).toBeLessThanOrEqual(HABIT_NAME_MAX_LENGTH)
      expect(habit.monthlyGoal).toBeGreaterThanOrEqual(MONTHLY_GOAL_MIN)
      expect(habit.monthlyGoal).toBeLessThanOrEqual(MONTHLY_GOAL_MAX)
      expect(Number.isInteger(habit.monthlyGoal)).toBe(true)
      expect(habit.archived).toBe(false)
      expect(habit.userId).not.toBe('')
      expect(Number.isNaN(parseDateString(habit.createdAt.slice(0, 10)).getTime())).toBe(false)
      expect(ids.has(habit.id)).toBe(false)
      ids.add(habit.id)
    }
  })

  it('uses the accent cycle in order, so the grid looks like the real thing', () => {
    expect(SAMPLE_HABITS.map((habit) => habit.color)).toEqual([
      'teal',
      'blue',
      'purple',
      'yellow',
      'coral',
      'teal',
      'blue',
      'purple',
      'yellow',
    ])
  })

  it('orders the habits by sortOrder and nothing else', () => {
    expect(SAMPLE_HABITS.map((habit) => habit.sortOrder)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('has one check-in per habit per day, all of them unique', () => {
    const pairs = SAMPLE_CHECKINS.map((checkin) => `${checkin.habitId} ${checkin.date}`)

    expect(new Set(pairs).size).toBe(pairs.length)
    expect(new Set(SAMPLE_CHECKINS.map((checkin) => checkin.id)).size).toBe(SAMPLE_CHECKINS.length)
  })

  it('has every check-in inside the sample month and up to the 22nd', () => {
    for (const checkin of SAMPLE_CHECKINS) {
      expect(checkin.date.startsWith(`${SAMPLE_MONTH}-`)).toBe(true)
      expect(Number(checkin.date.slice(8, 10))).toBeLessThanOrEqual(SAMPLE_LAST_DAY)
      expect(Number.isNaN(parseDateString(checkin.date).getTime())).toBe(false)
      expect(checkin.userId).toBe(SAMPLE_HABITS[0]?.userId ?? '')
    }
  })

  it('gives every check-in a habit that exists', () => {
    const ids = new Set(SAMPLE_HABITS.map((habit) => habit.id))

    for (const checkin of SAMPLE_CHECKINS) {
      expect(ids.has(checkin.habitId)).toBe(true)
    }
  })

  it('leaves a couple of habits behind on purpose, so the demo has range', () => {
    const completed = SAMPLE_HABITS.map((habit) =>
      habitCompleted(habit.id, SAMPLE_CHECKINS, SAMPLE_MONTH),
    )

    // Read a book chapter has met its goal, Floss is under half, Call grandpa
    // has barely started.
    expect(completed[2]).toBe(15)
    expect(completed[4]).toBe(9)
    expect(completed[6]).toBe(3)
    expect(Math.min(...completed)).toBeLessThan(5)
    expect(Math.max(...completed)).toBeGreaterThan(10)
  })

  it('produces sensible numbers through the statistics', () => {
    const monthTotals = totals(SAMPLE_HABITS, SAMPLE_CHECKINS, SAMPLE_MONTH)

    // 68 check-ins against a goal of 87. Two habits are past their own goal, so
    // the raw count and the capped count differ, which is the whole point of
    // keeping both.
    expect(monthTotals).toEqual({ completed: 68, goal: 87, cappedCompleted: 61 })
    expect(Number(monthlyProgressPct(monthTotals).toFixed(1))).toBe(70.1)
    expect(Number(normalizedProgressPct(monthTotals, SAMPLE_MONTH, SAMPLE_TODAY).toFixed(1))).toBe(
      98.8,
    )
    expect(momentumPct(SAMPLE_HABITS, SAMPLE_CHECKINS, SAMPLE_MONTH, SAMPLE_TODAY)).toBe(100)

    // 22 of 31 days gone, so nobody is asked for a whole month goal yet.
    const rate = successRatePct(SAMPLE_HABITS, SAMPLE_CHECKINS, SAMPLE_MONTH, SAMPLE_TODAY)

    expect(rate).toBe(67)
    expect(successMessage(rate)).toBe('Keep going')
  })

  it('shows a chart that stops on the 22nd', () => {
    const counts = dailyCounts(SAMPLE_HABITS, SAMPLE_CHECKINS, SAMPLE_MONTH, SAMPLE_TODAY)

    expect(counts).toHaveLength(31)
    expect(counts.slice(0, 22).every((count) => typeof count === 'number')).toBe(true)
    expect(counts.slice(22).every((count) => count === null)).toBe(true)
    expect(Math.max(...counts.filter((count): count is number => count !== null))).toBe(8)
    expect(counts.reduce<number>((sum, count) => sum + (count ?? 0), 0)).toBe(68)
  })

  it('gives every habit a streak worth showing', () => {
    const streaks = SAMPLE_HABITS.map((habit) => ({
      current: currentStreak(habit.id, SAMPLE_CHECKINS, SAMPLE_TODAY),
      longest: longestStreak(habit.id, SAMPLE_CHECKINS),
    }))

    // Every habit was checked on the 21st or the 22nd, so every one of them has
    // a live streak and the demo page has no zeroes on it.
    expect(streaks.every((streak) => streak.current >= 1)).toBe(true)
    expect(Math.max(...streaks.map((streak) => streak.longest))).toBe(10)
  })

  it('never shows a habit past its goal without the count showing it', () => {
    for (const habit of SAMPLE_HABITS) {
      const completed = habitCompleted(habit.id, SAMPLE_CHECKINS, SAMPLE_MONTH)

      expect(habitProgressPct(habit, completed)).toBeGreaterThanOrEqual(0)
      expect(habitProgressPct(habit, completed)).toBeLessThanOrEqual(100)
    }
  })
})
