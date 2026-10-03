/**
 * The shared domain model.
 *
 * These are the shapes the whole app agrees on: what a habit is, what a
 * check-in is, and how a month is addressed. Anything that reads or writes
 * habit data takes these types, so a change here is a change everywhere.
 */
import type { AccentName } from '@/lib/accents'

/** Inclusive bounds on a habit name. Enforced by the form and by the DB. */
export const HABIT_NAME_MIN_LENGTH = 1
export const HABIT_NAME_MAX_LENGTH = 40

/** Inclusive bounds on a monthly goal: at least once, at most once a day. */
export const MONTHLY_GOAL_MIN = 1
export const MONTHLY_GOAL_MAX = 31

/**
 * A calendar day in the user's own timezone, `YYYY-MM-DD`.
 *
 * Deliberately a string and never a `Date`. The day a check-in belongs to is
 * the day the user lived, so it must not be round-tripped through UTC or a
 * `Date`. Use `@/lib/dates` to build and parse these.
 *
 * The template form catches literals like `'2023-07-04'` at compile time and
 * rejects `'4 July'`. It cannot express the zero padding, so values assembled
 * at runtime go through `toDateString` or `todayString` rather than being cast
 * at the call site.
 */
export type DateString = `${number}-${number}-${number}`

/**
 * A calendar month in the user's own timezone, `YYYY-MM`, e.g. `'2023-07'`.
 *
 * A month is a view choice, not a stored field: check-ins are stored as
 * `DateString` and any month is derived from them by string prefix. Same
 * caveat as `DateString` about padding.
 */
export type MonthKey = `${number}-${number}`

/** The five habit colours. Re-exported so callers need not import the palette. */
export type HabitColor = AccentName

export interface Habit {
  id: string
  userId: string
  /** 1 to 40 characters. Trimmed, and empty is rejected. */
  name: string
  /**
   * How many days a month counts as done, 1 to 31. It is a target, not a
   * limit: checking in more times than this is allowed and is shown as
   * progress past 100 on that habit alone.
   */
  monthlyGoal: number
  /** Accent for the grid cell, the progress bar and the chart line. */
  color: HabitColor
  /** Position in the list. Ties are broken by `id`, never by name. */
  sortOrder: number
  /**
   * Archived habits keep their history and stop appearing in the tracker,
   * totals and every percentage. Unarchiving brings them back unchanged.
   */
  archived: boolean
  /** ISO 8601 timestamp from the database, e.g. `'2023-07-04T09:12:33Z'`. */
  createdAt: string
}

export interface Checkin {
  id: string
  habitId: string
  /** Denormalised from the habit so RLS can scope a check-in without a join. */
  userId: string
  /**
   * The calendar day this belongs to, in the user's own timezone. See the date
   * rules in `AGENTS.md`.
   */
  date: DateString
  createdAt: string
}
