/**
 * Test data factories.
 *
 * Tests should state the one field they care about and inherit the rest, so a
 * rule change lands in one place. Ids are unique per call so two habits or two
 * check-ins in the same test never collapse into each other by accident.
 */
import type { Checkin, Habit } from '@/types'

/** Fixed so nothing in a test depends on when it ran. */
export const TEST_USER_ID = 'user-test'

const CREATED_AT = '2023-07-01T09:00:00.000Z'

let sequence = 0

function nextId(prefix: string): string {
  sequence += 1

  return `${prefix}-${sequence.toString().padStart(3, '0')}`
}

export function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: nextId('habit'),
    userId: TEST_USER_ID,
    name: 'Test habit',
    monthlyGoal: 10,
    color: 'teal',
    sortOrder: 0,
    archived: false,
    createdAt: CREATED_AT,
    ...overrides,
  }
}

export function makeCheckin(overrides: Partial<Checkin> = {}): Checkin {
  return {
    id: nextId('checkin'),
    habitId: 'habit-unset',
    userId: TEST_USER_ID,
    date: '2023-07-01',
    createdAt: CREATED_AT,
    ...overrides,
  }
}

/** Check-ins for one habit on the given days of one month, e.g. `[1, 2, 3]`. */
export function checkinsOn(habitId: string, monthKey: string, days: readonly number[]): Checkin[] {
  return days.map((day) =>
    makeCheckin({
      habitId,
      date: `${monthKey}-${day.toString().padStart(2, '0')}` as Checkin['date'],
    }),
  )
}
