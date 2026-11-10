/**
 * Habit list rules: which habits the tracker shows, in what order, and when the
 * list is full.
 *
 * Pure functions over `Habit[]` with no fetch and no clock, so every rule here
 * is testable on its own. The server returns habits already ordered by
 * `sort_order` with `id` breaking ties; `orderHabits` repeats that rule for the
 * cache, because an optimistic write changes the list before the next fetch can.
 */
import { accentAt } from '@/lib/accents'
import type { Habit, HabitColor } from '@/types'

/**
 * Active habits the tracker will show. Beyond this the user is managing a list,
 * not forming habits, and the grid stops being readable.
 */
export const MAX_ACTIVE_HABITS = 15

/** True when there is room for one more active habit. */
export function canAddHabit(habits: readonly Habit[]): boolean {
  return activeHabitCount(habits) < MAX_ACTIVE_HABITS
}

export function activeHabitCount(habits: readonly Habit[]): number {
  let count = 0

  for (const habit of habits) {
    if (!habit.archived) {
      count += 1
    }
  }

  return count
}

/** The habits the tracker shows: active only, in list order. */
export function activeHabits(habits: readonly Habit[]): Habit[] {
  return habits.filter((habit) => !habit.archived)
}

/**
 * List order: `sortOrder` ascending, `id` breaking ties.
 *
 * Ties are broken here rather than left to the database because the optimistic
 * cache has no database to ask, and an order that changes depending on which
 * copy of the list you are looking at is a list that jumps.
 */
export function orderHabits(habits: readonly Habit[]): Habit[] {
  return [...habits].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder
    }

    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

/**
 * The cache after an optimistic create.
 *
 * An existing row with the same id is replaced rather than duplicated, which
 * makes the function safe to use for a retry or a replayed create.
 */
export function upsertHabitInList(habits: readonly Habit[], habit: Habit): Habit[] {
  return orderHabits([...habits.filter((existing) => existing.id !== habit.id), habit])
}

/**
 * The cache after an optimistic patch.
 *
 * Applying the patch through `orderHabits` matters for a reorder or a restore:
 * changing `sortOrder` can change the row's position in the same render. A patch
 * for an id that is no longer in the list changes nothing.
 */
export function patchHabitInList(
  habits: readonly Habit[],
  id: string,
  patch: Partial<Omit<Habit, 'id' | 'userId'>>,
): Habit[] {
  return orderHabits(habits.map((habit) => (habit.id === id ? { ...habit, ...patch } : habit)))
}

/**
 * The next colour in the five colour cycle, for a habit being added.
 *
 * Counted over every habit, archived included: an archived habit still owns its
 * colour in the user's mind, and handing its colour to a new habit would make
 * two screens disagree about what a colour means.
 */
export function nextHabitColor(habits: readonly Habit[]): HabitColor {
  return accentAt(habits.length)
}

/**
 * The `sortOrder` of the next habit to be created: one past the current
 * maximum, so a new habit lands at the bottom of the list rather than at a tie
 * the id would settle at random.
 */
export function nextSortOrder(habits: readonly Habit[]): number {
  let max = -1

  for (const habit of habits) {
    if (habit.sortOrder > max) {
      max = habit.sortOrder
    }
  }

  return max + 1
}

/** How each habit should be numbered after a reorder. */
export interface SortOrderWrite {
  id: string
  sortOrder: number
}

/**
 * Applies a new order to the active habits, leaving archived ones where they
 * are.
 *
 * Only habits whose number actually changes are returned, so a drag that ends
 * where it started writes nothing.
 */
export function planReorder(
  habits: readonly Habit[],
  orderedIds: readonly string[],
): SortOrderWrite[] {
  const wanted = new Map<string, number>()

  orderedIds.forEach((id, index) => {
    wanted.set(id, index)
  })

  const writes: SortOrderWrite[] = []

  for (const habit of habits) {
    const next = wanted.get(habit.id)

    if (next !== undefined && next !== habit.sortOrder) {
      writes.push({ id: habit.id, sortOrder: next })
    }
  }

  return writes
}

/**
 * The cache after a reorder: active habits numbered by their position in
 * `orderedIds`, in that same order, followed by the archived habits untouched.
 *
 * Ids that are not in `orderedIds` are archived habits or habits from another
 * device; they keep their number so a reorder on one device cannot silently
 * renumber habits another device has never sent.
 */
export function reorderHabits(habits: readonly Habit[], orderedIds: readonly string[]): Habit[] {
  const byId = new Map(habits.map((habit) => [habit.id, habit]))
  const listed = new Set(orderedIds)

  const numbered = orderedIds.flatMap((id, index) => {
    const habit = byId.get(id)

    return habit === undefined ? [] : [{ ...habit, sortOrder: index }]
  })

  const rest = orderHabits(habits.filter((habit) => !listed.has(habit.id)))

  return [...numbered, ...rest]
}

/**
 * The id order after moving one habit up or down a place.
 *
 * Returns the same list unchanged when the habit is already at the end, so a
 * keyboard user holding the button down stops at the top or the bottom instead
 * of wrapping around.
 */
export function moveHabit(orderedIds: readonly string[], id: string, direction: -1 | 1): string[] {
  const from = orderedIds.indexOf(id)
  const to = from + direction

  if (from < 0 || to < 0 || to >= orderedIds.length) {
    return [...orderedIds]
  }

  const next = [...orderedIds]
  const moving = next[from]
  const displaced = next[to]

  if (moving === undefined || displaced === undefined) {
    return [...orderedIds]
  }

  next[from] = displaced
  next[to] = moving

  return next
}
