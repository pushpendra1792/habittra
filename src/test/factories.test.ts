import { describe, expect, it } from 'vitest'

import { checkinsOn, makeCheckin, makeHabit, TEST_USER_ID } from '@/test/factories'

describe('makeHabit', () => {
  it('fills in every field, so a test only has to name the one it cares about', () => {
    const habit = makeHabit()

    // The id is generated per call, so it is swapped for a sentinel and the rest
    // of the record is compared whole.
    expect({ ...habit, id: 'generated' }).toEqual({
      id: 'generated',
      userId: TEST_USER_ID,
      name: 'Test habit',
      monthlyGoal: 10,
      color: 'teal',
      sortOrder: 0,
      archived: false,
      createdAt: '2023-07-01T09:00:00.000Z',
    })
  })

  it('lets an override win over the default', () => {
    const habit = makeHabit({ name: 'Walk 10,000 steps', monthlyGoal: 7, archived: true })

    expect(habit.name).toBe('Walk 10,000 steps')
    expect(habit.monthlyGoal).toBe(7)
    expect(habit.archived).toBe(true)
    // Untouched fields still come from the defaults.
    expect(habit.color).toBe('teal')
  })

  it('gives every habit its own id', () => {
    const first = makeHabit()
    const second = makeHabit()

    expect(first.id).not.toBe(second.id)
  })
})

describe('makeCheckin', () => {
  it('fills in every field', () => {
    const checkin = makeCheckin()

    expect({ ...checkin, id: 'generated' }).toEqual({
      id: 'generated',
      habitId: 'habit-unset',
      userId: TEST_USER_ID,
      date: '2023-07-01',
      createdAt: '2023-07-01T09:00:00.000Z',
    })
  })

  it('lets an override win over the default', () => {
    const checkin = makeCheckin({ habitId: 'habit-1', date: '2023-07-22' })

    expect(checkin.habitId).toBe('habit-1')
    expect(checkin.date).toBe('2023-07-22')
  })

  it('gives every check-in its own id, so duplicates have to be asked for', () => {
    expect(makeCheckin().id).not.toBe(makeCheckin().id)
  })
})

describe('checkinsOn', () => {
  it('builds one zero padded check-in per day of the month', () => {
    const checkins = checkinsOn('habit-1', '2023-07', [1, 2, 15])

    expect(checkins.map((checkin) => checkin.date)).toEqual([
      '2023-07-01',
      '2023-07-02',
      '2023-07-15',
    ])
    expect(checkins.every((checkin) => checkin.habitId === 'habit-1')).toBe(true)
    expect(checkins.every((checkin) => checkin.userId === TEST_USER_ID)).toBe(true)
  })

  it('pads a single digit day', () => {
    expect(checkinsOn('habit-1', '2023-07', [9])[0]?.date).toBe('2023-07-09')
  })

  it('returns an empty list for no days', () => {
    expect(checkinsOn('habit-1', '2023-07', [])).toEqual([])
  })
})
