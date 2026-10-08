import { describe, expect, it } from 'vitest'

import { makeCheckin } from '@/test/factories'
import type { Checkin } from '@/types'

import { applyCheckinToggle, hasCheckin, type CheckinToggle } from './checkinCache'

function toggle(overrides: Partial<CheckinToggle> = {}): CheckinToggle {
  return {
    habitId: 'habit-1',
    date: '2023-07-04',
    next: true,
    id: 'checkin-new',
    userId: 'user-test',
    createdAt: '2023-07-04T09:00:00.000Z',
    ...overrides,
  }
}

describe('hasCheckin', () => {
  it('finds a habit on a day', () => {
    const checkins = [makeCheckin({ habitId: 'habit-1', date: '2023-07-04' })]

    expect(hasCheckin(checkins, 'habit-1', '2023-07-04')).toBe(true)
  })

  it('does not confuse two habits on the same day', () => {
    const checkins = [makeCheckin({ habitId: 'habit-1', date: '2023-07-04' })]

    expect(hasCheckin(checkins, 'habit-2', '2023-07-04')).toBe(false)
  })

  it('does not confuse the same habit on two days', () => {
    const checkins = [makeCheckin({ habitId: 'habit-1', date: '2023-07-04' })]

    expect(hasCheckin(checkins, 'habit-1', '2023-07-05')).toBe(false)
  })
})

describe('applyCheckinToggle', () => {
  it('adds a check-in for an unchecked day', () => {
    const next = applyCheckinToggle([], toggle())

    expect(next).toHaveLength(1)
    expect(next[0]).toEqual({
      id: 'checkin-new',
      habitId: 'habit-1',
      userId: 'user-test',
      date: '2023-07-04',
      createdAt: '2023-07-04T09:00:00.000Z',
    })
  })

  it('removes a check-in for a checked day', () => {
    const existing = makeCheckin({ habitId: 'habit-1', date: '2023-07-04' })
    const other = makeCheckin({ habitId: 'habit-1', date: '2023-07-05' })

    const next = applyCheckinToggle([existing, other], toggle({ next: false }))

    expect(next).toEqual([other])
  })

  it('leaves every other habit alone', () => {
    const mine = makeCheckin({ habitId: 'habit-1', date: '2023-07-04' })
    const theirs = makeCheckin({ habitId: 'habit-2', date: '2023-07-04' })

    const next = applyCheckinToggle([mine, theirs], toggle({ next: false }))

    expect(next).toEqual([theirs])
  })

  it('adds a second habit on a day that already has one', () => {
    const theirs = makeCheckin({ habitId: 'habit-2', date: '2023-07-04' })

    const next = applyCheckinToggle([theirs], toggle())

    expect(next).toHaveLength(2)
    expect(next.map((checkin) => checkin.habitId)).toEqual(['habit-2', 'habit-1'])
  })

  it('does not add a duplicate when the day is already checked', () => {
    const existing = makeCheckin({ habitId: 'habit-1', date: '2023-07-04' })

    const next = applyCheckinToggle([existing], toggle({ next: true }))

    expect(next).toHaveLength(1)
    expect(next[0]).toBe(existing)
  })

  it('does nothing when removing a day that was never checked', () => {
    const other = makeCheckin({ habitId: 'habit-1', date: '2023-07-05' })

    const next = applyCheckinToggle([other], toggle({ next: false }))

    expect(next).toHaveLength(1)
    expect(next[0]).toBe(other)
  })

  it('treats an empty cache as an empty month', () => {
    expect(applyCheckinToggle(undefined, toggle())).toHaveLength(1)
    expect(applyCheckinToggle(undefined, toggle({ next: false }))).toEqual([])
  })

  it('never mutates the list it was given', () => {
    const existing = makeCheckin({ habitId: 'habit-1', date: '2023-07-04' })
    const before: Checkin[] = [existing]

    applyCheckinToggle(before, toggle({ next: false }))

    expect(before).toHaveLength(1)
  })

  it('keeps the day exactly as the tap said it was', () => {
    const next = applyCheckinToggle([], toggle({ date: '2023-12-31' }))

    expect(next[0]?.date).toBe('2023-12-31')
  })
})
