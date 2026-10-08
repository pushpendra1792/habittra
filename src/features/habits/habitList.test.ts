import { describe, expect, it } from 'vitest'

import { makeHabit } from '@/test/factories'

import {
  MAX_ACTIVE_HABITS,
  activeHabitCount,
  activeHabits,
  canAddHabit,
  moveHabit,
  nextHabitColor,
  nextSortOrder,
  orderHabits,
  planReorder,
  reorderHabits,
} from './habitList'

describe('orderHabits', () => {
  it('sorts by sortOrder ascending', () => {
    const habits = [
      makeHabit({ id: 'c', sortOrder: 5 }),
      makeHabit({ id: 'a', sortOrder: 1 }),
      makeHabit({ id: 'b', sortOrder: 3 }),
    ]

    expect(orderHabits(habits).map((habit) => habit.id)).toEqual(['a', 'b', 'c'])
  })

  it('breaks ties on id, so the order is the same on every device', () => {
    const habits = [
      makeHabit({ id: 'z', sortOrder: 0 }),
      makeHabit({ id: 'a', sortOrder: 0 }),
      makeHabit({ id: 'm', sortOrder: 0 }),
    ]

    expect(orderHabits(habits).map((habit) => habit.id)).toEqual(['a', 'm', 'z'])
  })

  it('is stable when the list is already ordered', () => {
    const habits = [makeHabit({ id: 'a', sortOrder: 0 }), makeHabit({ id: 'b', sortOrder: 1 })]

    expect(orderHabits(habits).map((habit) => habit.id)).toEqual(['a', 'b'])
  })

  it('handles an empty list and a single habit', () => {
    expect(orderHabits([])).toEqual([])
    expect(orderHabits([makeHabit({ id: 'solo' })])).toHaveLength(1)
  })

  it('does not reorder the array it was given', () => {
    const habits = [makeHabit({ id: 'b', sortOrder: 2 }), makeHabit({ id: 'a', sortOrder: 1 })]

    orderHabits(habits)

    expect(habits.map((habit) => habit.id)).toEqual(['b', 'a'])
  })
})

describe('active habits', () => {
  it('leaves archived habits out of the tracker', () => {
    const habits = [
      makeHabit({ id: 'a', archived: false }),
      makeHabit({ id: 'b', archived: true }),
      makeHabit({ id: 'c', archived: false }),
    ]

    expect(activeHabits(habits).map((habit) => habit.id)).toEqual(['a', 'c'])
    expect(activeHabitCount(habits)).toBe(2)
  })

  it('counts nothing in an empty list', () => {
    expect(activeHabitCount([])).toBe(0)
    expect(activeHabits([])).toEqual([])
  })
})

describe('the 15 habit limit', () => {
  it('allows a habit while the list is below the limit', () => {
    const habits = Array.from({ length: MAX_ACTIVE_HABITS - 1 }, (_, index) =>
      makeHabit({ id: `h-${index}` }),
    )

    expect(activeHabitCount(habits)).toBe(14)
    expect(canAddHabit(habits)).toBe(true)
  })

  it('stops at the limit', () => {
    const habits = Array.from({ length: MAX_ACTIVE_HABITS }, (_, index) =>
      makeHabit({ id: `h-${index}` }),
    )

    expect(activeHabitCount(habits)).toBe(15)
    expect(canAddHabit(habits)).toBe(false)
  })

  it('counts an archived habit as room, not as a place taken', () => {
    const habits = [
      ...Array.from({ length: MAX_ACTIVE_HABITS }, (_, index) => makeHabit({ id: `h-${index}` })),
      makeHabit({ id: 'archived', archived: true }),
    ]

    expect(activeHabitCount(habits)).toBe(15)
    expect(canAddHabit(habits)).toBe(false)

    habits[0]!.archived = true

    expect(canAddHabit(habits)).toBe(true)
  })

  it('allows the first habit on an empty account', () => {
    expect(canAddHabit([])).toBe(true)
  })
})

describe('nextHabitColor', () => {
  it('walks the five colour cycle', () => {
    expect(nextHabitColor([])).toBe('teal')
    expect(nextHabitColor([makeHabit()])).toBe('blue')
    expect(nextHabitColor(Array.from({ length: 4 }, () => makeHabit()))).toBe('coral')
    expect(nextHabitColor(Array.from({ length: 5 }, () => makeHabit()))).toBe('teal')
  })

  it('counts archived habits too, so two habits never share a colour by accident', () => {
    const habits = [makeHabit(), makeHabit({ archived: true })]

    expect(nextHabitColor(habits)).toBe('purple')
  })
})

describe('nextSortOrder', () => {
  it('is one past the current maximum', () => {
    const habits = [makeHabit({ sortOrder: 0 }), makeHabit({ sortOrder: 4 })]

    expect(nextSortOrder(habits)).toBe(5)
  })

  it('starts at 0 on an empty account', () => {
    expect(nextSortOrder([])).toBe(0)
  })

  it('looks at every habit, archived or not', () => {
    const habits = [makeHabit({ sortOrder: 1 }), makeHabit({ sortOrder: 9, archived: true })]

    expect(nextSortOrder(habits)).toBe(10)
  })
})

describe('planReorder', () => {
  it('writes only the habits whose number changes', () => {
    const habits = [
      makeHabit({ id: 'a', sortOrder: 0 }),
      makeHabit({ id: 'b', sortOrder: 1 }),
      makeHabit({ id: 'c', sortOrder: 2 }),
    ]

    // In the order the habits arrive, which is the order the cache holds them.
    expect(planReorder(habits, ['c', 'a', 'b'])).toEqual([
      { id: 'a', sortOrder: 1 },
      { id: 'b', sortOrder: 2 },
      { id: 'c', sortOrder: 0 },
    ])
  })

  it('writes nothing when the order does not change', () => {
    const habits = [makeHabit({ id: 'a', sortOrder: 0 }), makeHabit({ id: 'b', sortOrder: 1 })]

    expect(planReorder(habits, ['a', 'b'])).toEqual([])
  })

  it('ignores archived habits, which are not in the ordered list', () => {
    const habits = [
      makeHabit({ id: 'a', sortOrder: 0 }),
      makeHabit({ id: 'old', sortOrder: 1, archived: true }),
      makeHabit({ id: 'b', sortOrder: 5 }),
    ]

    expect(planReorder(habits, ['b', 'a'])).toEqual([
      { id: 'a', sortOrder: 1 },
      { id: 'b', sortOrder: 0 },
    ])
  })

  it('writes nothing for an empty list', () => {
    expect(planReorder([], [])).toEqual([])
  })
})

describe('reorderHabits', () => {
  it('numbers the active habits by their position', () => {
    const habits = [
      makeHabit({ id: 'a', sortOrder: 0 }),
      makeHabit({ id: 'b', sortOrder: 1 }),
      makeHabit({ id: 'c', sortOrder: 2 }),
    ]

    const next = reorderHabits(habits, ['c', 'a', 'b'])

    expect(next.filter((habit) => !habit.archived).map((habit) => habit.sortOrder)).toEqual([
      0, 1, 2,
    ])
    expect(orderHabits(next).map((habit) => habit.id)).toEqual(['c', 'a', 'b'])
  })

  it('leaves archived habits untouched', () => {
    const habits = [
      makeHabit({ id: 'a', sortOrder: 0 }),
      makeHabit({ id: 'old', sortOrder: 7, archived: true }),
      makeHabit({ id: 'b', sortOrder: 1 }),
    ]

    const next = reorderHabits(habits, ['b', 'a'])

    expect(next.find((habit) => habit.id === 'old')?.sortOrder).toBe(7)
  })

  it('keeps habits the reorder never mentioned', () => {
    const habits = [makeHabit({ id: 'a', sortOrder: 0 }), makeHabit({ id: 'b', sortOrder: 1 })]

    const next = reorderHabits(habits, ['a'])

    expect(next.find((habit) => habit.id === 'b')?.sortOrder).toBe(1)
  })

  it('does not mutate the habits it was given', () => {
    const habits = [makeHabit({ id: 'a', sortOrder: 0 }), makeHabit({ id: 'b', sortOrder: 1 })]

    reorderHabits(habits, ['b', 'a'])

    expect(habits[0]?.sortOrder).toBe(0)
  })
})

describe('moveHabit', () => {
  const ids = ['a', 'b', 'c']

  it('moves a habit down and up one place', () => {
    expect(moveHabit(ids, 'a', 1)).toEqual(['b', 'a', 'c'])
    expect(moveHabit(ids, 'c', -1)).toEqual(['a', 'c', 'b'])
  })

  it('stops at the ends rather than wrapping', () => {
    expect(moveHabit(ids, 'a', -1)).toEqual(['a', 'b', 'c'])
    expect(moveHabit(ids, 'c', 1)).toEqual(['a', 'b', 'c'])
  })

  it('leaves the list alone for a habit that is not in it', () => {
    expect(moveHabit(ids, 'missing', 1)).toEqual(['a', 'b', 'c'])
    expect(moveHabit(ids, 'missing', -1)).toEqual(['a', 'b', 'c'])
  })

  it('handles a list of one', () => {
    expect(moveHabit(['solo'], 'solo', 1)).toEqual(['solo'])
    expect(moveHabit(['solo'], 'solo', -1)).toEqual(['solo'])
  })

  it('does not mutate the list it was given', () => {
    moveHabit(ids, 'a', 1)

    expect(ids).toEqual(['a', 'b', 'c'])
  })
})
