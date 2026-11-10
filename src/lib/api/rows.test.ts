import { describe, expect, it } from 'vitest'

import {
  isHabitColor,
  toAppDate,
  toCheckin,
  toCheckinInsert,
  toCheckins,
  toHabit,
  toHabits,
  toHabitInsert,
  toHabitUpdate,
  type CheckinRow,
  type HabitRow,
} from '@/lib/api/rows'
import type { Checkin } from '@/types'

/** A habits row with every column present, as PostgREST returns it. */
function habitRow(overrides: Partial<HabitRow> = {}): HabitRow {
  return {
    id: 'habit-row-1',
    user_id: 'user-row-1',
    name: 'Read',
    monthly_goal: 12,
    color: 'teal',
    sort_order: 3,
    archived: false,
    created_at: '2023-07-01T09:00:00.000Z',
    updated_at: '2023-07-02T10:11:12.000Z',
    ...overrides,
  }
}

function checkinRow(overrides: Partial<CheckinRow> = {}): CheckinRow {
  return {
    id: 'checkin-row-1',
    habit_id: 'habit-row-1',
    user_id: 'user-row-1',
    date: '2023-07-04',
    created_at: '2023-07-04T08:00:00.000Z',
    ...overrides,
  }
}

describe('toAppDate', () => {
  it('passes a well formed date through unchanged', () => {
    expect(toAppDate('2023-07-04')).toBe('2023-07-04')
  })

  it('passes every day of a leap February through unchanged', () => {
    expect(toAppDate('2024-02-29')).toBe('2024-02-29')
  })

  it('does not shift the day, because it never converts a timezone', () => {
    // Nothing here touches a Date, so there is no local or UTC day to disagree
    // about. The string the user checked in on is the string that comes back.
    expect(toAppDate('2023-12-31')).toBe('2023-12-31')
    expect(toAppDate('2023-01-01')).toBe('2023-01-01')
  })

  it('refuses a value that is not a bare YYYY-MM-DD', () => {
    for (const value of [
      '',
      '2023-7-04',
      '2023-07-4',
      '2023-07-04T00:00:00Z',
      '2023-07-04 00:00:00+05:30',
      '20230704',
      'not-a-date',
    ]) {
      expect(() => toAppDate(value)).toThrow()
    }
  })

  it('says what it got when it refuses, rather than just that it failed', () => {
    expect(() => toAppDate('4 July 2023')).toThrow(/4 July 2023/)
  })
})

describe('isHabitColor', () => {
  it('accepts each of the five accent names', () => {
    for (const color of ['teal', 'blue', 'purple', 'yellow', 'coral'] as const) {
      expect(isHabitColor(color)).toBe(true)
    }
  })

  it('rejects an unknown, empty or differently cased value', () => {
    expect(isHabitColor('chartreuse')).toBe(false)
    expect(isHabitColor('')).toBe(false)
    expect(isHabitColor('TEAL')).toBe(false)
  })
})

describe('toHabit', () => {
  it('maps every column to its camelCase field', () => {
    expect(toHabit(habitRow())).toEqual({
      id: 'habit-row-1',
      userId: 'user-row-1',
      name: 'Read',
      monthlyGoal: 12,
      color: 'teal',
      sortOrder: 3,
      archived: false,
      createdAt: '2023-07-01T09:00:00.000Z',
    })
  })

  it('keeps the id a string and never turns a timestamp into a Date', () => {
    const habit = toHabit(habitRow())

    expect(typeof habit.id).toBe('string')
    expect(habit.createdAt).toBe('2023-07-01T09:00:00.000Z')
  })

  it('maps the boundaries of the column checks without complaining', () => {
    expect(toHabit(habitRow({ name: 'A', monthly_goal: 1 })).monthlyGoal).toBe(1)
    expect(toHabit(habitRow({ name: 'x'.repeat(40), monthly_goal: 31 })).name).toHaveLength(40)
  })

  it('maps an archived habit as archived rather than dropping it', () => {
    expect(toHabit(habitRow({ archived: true })).archived).toBe(true)
  })

  it('maps every accent name', () => {
    for (const color of ['teal', 'blue', 'purple', 'yellow', 'coral'] as const) {
      expect(toHabit(habitRow({ color })).color).toBe(color)
    }
  })

  it('falls back to teal when the row has an unknown colour', () => {
    expect(toHabit(habitRow({ color: 'chartreuse' })).color).toBe('teal')
  })

  it('maps a negative sort order, which is a legitimate tiebreaker value', () => {
    expect(toHabit(habitRow({ sort_order: -5 })).sortOrder).toBe(-5)
  })

  it('drops updated_at instead of passing it off as createdAt', () => {
    // Two different timestamps and only one field in the app's Habit. Inventing a
    // second date would mean showing "created" for a value that means "changed".
    const habit = toHabit(
      habitRow({
        created_at: '2023-07-01T09:00:00.000Z',
        updated_at: '2023-08-01T09:00:00.000Z',
      }),
    )

    expect(habit.createdAt).toBe('2023-07-01T09:00:00.000Z')
    expect(Object.keys(habit)).not.toContain('updatedAt')
  })
})

describe('toCheckin', () => {
  it('maps every column to its camelCase field', () => {
    expect(toCheckin(checkinRow())).toEqual({
      id: 'checkin-row-1',
      habitId: 'habit-row-1',
      userId: 'user-row-1',
      date: '2023-07-04',
      createdAt: '2023-07-04T08:00:00.000Z',
    })
  })

  it('keeps the day the user checked in on', () => {
    expect(toCheckin(checkinRow({ date: '2023-07-01' })).date).toBe('2023-07-01')
    expect(toCheckin(checkinRow({ date: '2023-07-31' })).date).toBe('2023-07-31')
  })

  it('throws rather than passing a malformed date through as a DateString', () => {
    expect(() => toCheckin(checkinRow({ date: '04/07/2023' }))).toThrow()
  })
})

describe('toHabits and toCheckins', () => {
  it('map a whole result set', () => {
    const habits = toHabits([habitRow({ id: 'a' }), habitRow({ id: 'b' })])
    const checkins = toCheckins([checkinRow({ id: 'a' }), checkinRow({ id: 'b' })])

    expect(habits.map((habit) => habit.id)).toEqual(['a', 'b'])
    expect(checkins.map((checkin) => checkin.id)).toEqual(['a', 'b'])
  })

  it('return an empty list for an empty result set', () => {
    expect(toHabits([])).toEqual([])
    expect(toCheckins([])).toEqual([])
  })
})

describe('toHabitInsert', () => {
  it('turns camelCase into snake_case', () => {
    expect(toHabitInsert({ name: 'Read', monthlyGoal: 12, color: 'teal' })).toEqual({
      name: 'Read',
      monthly_goal: 12,
      color: 'teal',
    })
  })

  it('trims the name, so a padded name cannot fail the length check', () => {
    expect(toHabitInsert({ name: '  Read  ', monthlyGoal: 12, color: 'blue' }).name).toBe('Read')
  })

  it('never sends a user_id, because the database fills it from the session', () => {
    const row = toHabitInsert({ name: 'Read', monthlyGoal: 12, color: 'teal' })

    expect(Object.keys(row)).not.toContain('user_id')
  })

  it('omits sort order when there is none, so the column default applies', () => {
    expect(toHabitInsert({ name: 'Read', monthlyGoal: 12, color: 'teal' })).not.toHaveProperty(
      'sort_order',
    )
  })

  it('sends a sort order of zero, which is a value and not an absence', () => {
    expect(toHabitInsert({ name: 'Read', monthlyGoal: 12, color: 'teal', sortOrder: 0 })).toEqual({
      name: 'Read',
      monthly_goal: 12,
      color: 'teal',
      sort_order: 0,
    })
  })

  it('keeps a client-generated id so an offline create can be replayed', () => {
    expect(
      toHabitInsert({
        id: 'habit-client-1',
        name: 'Read',
        monthlyGoal: 12,
        color: 'teal',
      }),
    ).toEqual({
      id: 'habit-client-1',
      name: 'Read',
      monthly_goal: 12,
      color: 'teal',
    })
  })

  it('produces a row that maps back to a habit', () => {
    const row = toHabitInsert({ name: 'Read', monthlyGoal: 12, color: 'purple', sortOrder: 2 })
    const habit = toHabit(habitRow(row))

    expect(habit.name).toBe('Read')
    expect(habit.monthlyGoal).toBe(12)
    expect(habit.color).toBe('purple')
    expect(habit.sortOrder).toBe(2)
  })
})

describe('toHabitUpdate', () => {
  it('sends only the field that changed', () => {
    expect(toHabitUpdate({ name: 'Run' })).toEqual({ name: 'Run' })
  })

  it('returns an empty row for an empty patch, rather than clearing the habit', () => {
    // Every column absent means every column absent. Sending nulls here would
    // wipe the habit.
    expect(toHabitUpdate({})).toEqual({})
  })

  it('maps every writable field', () => {
    expect(
      toHabitUpdate({
        name: ' Swim ',
        monthlyGoal: 20,
        color: 'coral',
        sortOrder: 7,
        archived: true,
      }),
    ).toEqual({
      name: 'Swim',
      monthly_goal: 20,
      color: 'coral',
      sort_order: 7,
      archived: true,
    })
  })

  it('keeps false and zero instead of treating them as absent', () => {
    // The difference between "do not change this" and "change it to false" is
    // the whole point of a patch, and it is invisible to a truthiness check.
    expect(toHabitUpdate({ archived: false })).toEqual({ archived: false })
    expect(toHabitUpdate({ sortOrder: 0 })).toEqual({ sort_order: 0 })
    expect(toHabitUpdate({ monthlyGoal: 0 })).toEqual({ monthly_goal: 0 })
  })

  it('never sends a user_id, so ownership cannot be moved by an update', () => {
    expect(Object.keys(toHabitUpdate({ name: 'Run', archived: true }))).not.toContain('user_id')
  })
})

describe('toCheckinInsert', () => {
  it('sends the id, the habit and the day, and nothing else', () => {
    expect(toCheckinInsert('habit-row-1', '2023-07-04', 'checkin-new-1')).toEqual({
      id: 'checkin-new-1',
      habit_id: 'habit-row-1',
      date: '2023-07-04',
    })
  })

  it('never sends a user_id, because the database fills it from the session', () => {
    expect(
      Object.keys(toCheckinInsert('habit-row-1', '2023-07-04', 'checkin-new-1')),
    ).not.toContain('user_id')
  })

  it('round trips through the row mapper without moving the day', () => {
    const insert = toCheckinInsert('habit-row-1', '2023-01-01', 'checkin-new-2')
    const checkin: Checkin = toCheckin(checkinRow(insert))

    expect(checkin.date).toBe('2023-01-01')
  })

  it('keeps the caller-supplied id, so a replayed write is the same row', () => {
    const insert = toCheckinInsert('habit-row-1', '2023-07-04', 'checkin-queued-1')

    expect(toCheckin(checkinRow(insert)).id).toBe('checkin-queued-1')
    expect(toCheckinInsert('habit-row-1', '2023-07-04', 'checkin-queued-1')).toEqual(insert)
  })

  it('round trips the first and last day of a year', () => {
    for (const day of ['2023-01-01', '2023-12-31'] as const) {
      expect(toCheckin(checkinRow(toCheckinInsert('h', day, 'checkin-year'))).date).toBe(day)
    }
  })
})
