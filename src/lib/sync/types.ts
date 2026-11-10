/**
 * The operations the offline queue can hold.
 *
 * These are intentionally data-only. Nothing here talks to IndexedDB or
 * Supabase; the queue and its executor live on either side of this contract.
 * Every operation keeps the client-generated id that created it, so replaying a
 * request is the same request rather than a second row.
 */
import type { HabitPatch, NewHabit } from '@/lib/api/rows'
import type { DateString } from '@/types'

export type SyncOperationKind = 'add_checkin' | 'remove_checkin' | 'create_habit' | 'update_habit'

interface SyncOperationBase {
  /** Client-generated id for this queue entry, not the check-in or habit id. */
  id: string
  userId: string
  /** ISO timestamp, used for display and ordering evidence. */
  createdAt: string
  /** Number of network attempts already made. Auth and permanent stops do not add. */
  retryCount: number
}

export interface AddCheckinOperation extends SyncOperationBase {
  kind: 'add_checkin'
  habitId: string
  date: DateString
  /** The same id the optimistic cache row carries. */
  checkinId: string
}

export interface RemoveCheckinOperation extends SyncOperationBase {
  kind: 'remove_checkin'
  habitId: string
  date: DateString
}

export interface CreateHabitOperation extends SyncOperationBase {
  kind: 'create_habit'
  /** Includes the client-generated id so a replay cannot create a second habit. */
  habit: NewHabit & { id: string }
}

export interface UpdateHabitOperation extends SyncOperationBase {
  kind: 'update_habit'
  habitId: string
  patch: HabitPatch
}

export type SyncOperation =
  AddCheckinOperation | RemoveCheckinOperation | CreateHabitOperation | UpdateHabitOperation

/** One operation that will not succeed without a change the user has to make. */
export interface FailedOperation {
  operation: SyncOperation
  /** User-facing sentence produced by the permanent error. */
  message: string
  failedAt: string
  /** False until the one toast for this failure has been shown. */
  notified: boolean
}

/** The persisted queue for one user. */
export interface SyncSnapshot {
  pending: SyncOperation[]
  failed: FailedOperation[]
}

export function emptySyncSnapshot(): SyncSnapshot {
  return { pending: [], failed: [] }
}
