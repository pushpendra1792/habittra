/**
 * Row mapping, in both directions.
 *
 * The database speaks snake_case; the app speaks camelCase. Every crossing
 * between the two goes through this file, so a column rename is one edit here
 * rather than a search across the app, and so the mapping can be tested without
 * a network.
 *
 * Nothing in this file touches Supabase. It takes values and returns values.
 */
import { ACCENT_NAMES } from '@/lib/accents'
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/database.types'
import type { Checkin, DateString, Habit, HabitColor } from '@/types'

export type HabitRow = Tables<'habits'>
export type CheckinRow = Tables<'checkins'>
export type ProfileRow = Tables<'profiles'>

/**
 * The insert rows the API builds. `user_id` is deliberately absent: the
 * `set_row_user_id` trigger stamps it from `auth.uid()`.
 */
export type HabitInsertRow = Omit<TablesInsert<'habits'>, 'user_id'>
export type HabitUpdateRow = TablesUpdate<'habits'>
export type CheckinInsertRow = Omit<TablesInsert<'checkins'>, 'user_id'>

/** A colour this build can render, used when a row carries an unknown value. */
const FALLBACK_HABIT_COLOR: HabitColor = 'teal'

/** Narrows a database `color` value to one of the five accents. */
export function isHabitColor(value: string): value is HabitColor {
  return ACCENT_NAMES.some((color) => color === value)
}

/** A habit as the app describes it. camelCase, and no fields the UI never reads. */
export interface NewHabit {
  /** Client-generated id, so an offline create can be replayed safely. */
  id?: string
  name: string
  monthlyGoal: number
  color: HabitColor
  /** Omitted on create when absent, so the column default of 0 applies. */
  sortOrder?: number
}

/** A partial change to a habit. Only the keys present are written. */
export interface HabitPatch {
  name?: string
  monthlyGoal?: number
  color?: HabitColor
  sortOrder?: number
  archived?: boolean
}

const DATE_STRING = /^\d{4}-\d{2}-\d{2}$/

/**
 * Reads a `date` column as a `DateString`.
 *
 * A Postgres `date` comes back over PostgREST as `YYYY-MM-DD` already, so this
 * is a type assertion the compiler cannot do on its own rather than a
 * transformation. The shape is checked anyway: the column is typed `string`, so
 * a malformed value would otherwise become a DateString by assumption and then
 * land in the wrong month of a total, silently.
 *
 * This is not a timezone conversion and must never become one. The value is
 * already the calendar day the user lived. See the date rules in AGENTS.md.
 */
export function toAppDate(value: string): DateString {
  if (!DATE_STRING.test(value)) {
    throw new Error(`Expected a YYYY-MM-DD date from the database, got ${JSON.stringify(value)}`)
  }

  return value as DateString
}

/** A database habit row as the app's `Habit`. */
export function toHabit(row: HabitRow): Habit {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    monthlyGoal: row.monthly_goal,
    // A hand-edited row or an older schema can carry a colour this build does
    // not know. Falling back keeps the UI renderable instead of casting an
    // unknown string into the five-colour type.
    color: isHabitColor(row.color) ? row.color : FALLBACK_HABIT_COLOR,
    sortOrder: row.sort_order,
    archived: row.archived,
    createdAt: row.created_at,
  }
}

/**
 * A database check-in row as the app's `Checkin`.
 *
 * `updated_at` on habits has no counterpart in `Habit`. The app does not show
 * it and nothing sorts by it, so it is left in the row type rather than
 * invented as a second `createdAt` that would be wrong.
 */
export function toCheckin(row: CheckinRow): Checkin {
  return {
    id: row.id,
    habitId: row.habit_id,
    userId: row.user_id,
    date: toAppDate(row.date),
    createdAt: row.created_at,
  }
}

/** A whole result set. */
export function toHabits(rows: readonly HabitRow[]): Habit[] {
  return rows.map(toHabit)
}

/** A whole result set. */
export function toCheckins(rows: readonly CheckinRow[]): Checkin[] {
  return rows.map(toCheckin)
}

/**
 * A new habit as an insert row.
 *
 * No `user_id`: the database fills it from the session, so a caller cannot
 * create a habit inside somebody else's account even if it tried. `name` is
 * trimmed here rather than in the component, so the 40 character check in the
 * schema sees the same string the user thinks they typed.
 */
export function toHabitInsert(habit: NewHabit): HabitInsertRow {
  const row: HabitInsertRow = {
    name: habit.name.trim(),
    monthly_goal: habit.monthlyGoal,
    color: habit.color,
  }

  if (habit.id !== undefined) {
    row.id = habit.id
  }

  if (habit.sortOrder !== undefined) {
    row.sort_order = habit.sortOrder
  }

  return row
}

/**
 * A patch as an update row.
 *
 * Only keys actually present are included. Postgres rejects `undefined` in an
 * update payload rather than ignoring it, so sending every field with `null` for
 * the absent ones would clear columns instead of leaving them alone.
 */
export function toHabitUpdate(patch: HabitPatch): HabitUpdateRow {
  const row: HabitUpdateRow = {}

  if (patch.name !== undefined) {
    row.name = patch.name.trim()
  }

  if (patch.monthlyGoal !== undefined) {
    row.monthly_goal = patch.monthlyGoal
  }

  if (patch.color !== undefined) {
    row.color = patch.color
  }

  if (patch.sortOrder !== undefined) {
    row.sort_order = patch.sortOrder
  }

  if (patch.archived !== undefined) {
    row.archived = patch.archived
  }

  return row
}

/**
 * A check-in as an insert row.
 *
 * No `user_id` and no `date` conversion: the day is already the string the app
 * has been using all along, and it goes to a `date` column unchanged. Passing it
 * through `Date` first is exactly the round trip the date rules forbid.
 *
 * `id` is supplied by the caller rather than left to `gen_random_uuid()`, so a
 * write queued while offline keeps one identity across every retry: the same
 * request is recognisable as the same request instead of arriving as a second
 * row with a second id.
 */
export function toCheckinInsert(habitId: string, date: DateString, id: string): CheckinInsertRow {
  return { id, habit_id: habitId, date }
}
