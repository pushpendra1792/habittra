/**
 * The optimistic check-in cache.
 *
 * Tapping a cell has to change the cell before the network agrees, and a failed
 * write has to put the cache back exactly as it was. Both halves are pure
 * functions over the list in the cache: no Supabase, no clock unless the caller
 * passes one, no reading of global state. That is what makes the rollback
 * testable without pretending to talk to a server.
 *
 * Dates stay `YYYY-MM-DD` strings throughout. Nothing here builds a `Date`, so
 * no check-in can be moved to the wrong day by a timezone.
 */
import type { Checkin, DateString } from '@/types'

/** One cell tap, decided by the component that rendered the cell. */
export interface CheckinToggle {
  habitId: string
  date: DateString
  /** The state the cell is moving to: true records, false removes. */
  next: boolean
  /** Client-generated id, so a replayed write is recognisably the same row. */
  id: string
  userId: string
  /** `createdAt` for a row being added. ISO timestamp, not a calendar day. */
  createdAt: string
}

/** True when the list already holds this habit on this day. */
export function hasCheckin(
  checkins: readonly Checkin[],
  habitId: string,
  date: DateString,
): boolean {
  return checkins.some((checkin) => checkin.habitId === habitId && checkin.date === date)
}

/**
 * The list after one toggle.
 *
 * Adding a check-in that is already there, or removing one that is not, changes
 * nothing and returns the same reference: the cell the user just tapped is
 * already in the state they asked for, and re-rendering every row to say so
 * would be work for no reason. That case is also what a double tap produces
 * while the first request is still in flight.
 */
export function applyCheckinToggle(
  checkins: Checkin[] | undefined,
  toggle: CheckinToggle,
): Checkin[] {
  const current = checkins ?? []
  const present = hasCheckin(current, toggle.habitId, toggle.date)

  if (present === toggle.next) {
    return current
  }

  if (!toggle.next) {
    return current.filter(
      (checkin) => !(checkin.habitId === toggle.habitId && checkin.date === toggle.date),
    )
  }

  return [
    ...current,
    {
      id: toggle.id,
      habitId: toggle.habitId,
      userId: toggle.userId,
      date: toggle.date,
      createdAt: toggle.createdAt,
    },
  ]
}
