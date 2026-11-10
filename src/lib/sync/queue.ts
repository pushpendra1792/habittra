/**
 * The queue rules, as pure data transformations.
 *
 * Nothing here opens IndexedDB, calls Supabase or starts a timer. A queue is an
 * ordered array, an operation is a value, and the executor is passed in. That
 * makes collapse, ordering and retry behaviour testable without a browser or a
 * fake server.
 */
import { databaseErrorMessage } from '@/lib/api/errors'
import type { DateString } from '@/types'

import type {
  AddCheckinOperation,
  FailedOperation,
  RemoveCheckinOperation,
  SyncOperation,
  SyncSnapshot,
} from './types'

/** The two check-in operations share a target: one habit on one calendar day. */
export type CheckinOperation = AddCheckinOperation | RemoveCheckinOperation

/** True when this operation changes one cell in the grid. */
export function isCheckinOperation(operation: SyncOperation): operation is CheckinOperation {
  return operation.kind === 'add_checkin' || operation.kind === 'remove_checkin'
}

/** A stable key for the `(habit, date)` inside a check-in operation. */
export function checkinTarget(operation: CheckinOperation): string {
  return `${operation.habitId}\u0000${operation.date}`
}

/**
 * Keeps only the latest check-in operation for each cell.
 *
 * An add followed by a remove means the user's final answer is "not checked",
 * so the add can go. The reverse keeps only the add. Operations for habits and
 * other days are left exactly where they were, which is what keeps a create
 * ahead of the check-in that depends on it.
 */
export function collapseOperations(operations: readonly SyncOperation[]): SyncOperation[] {
  const latestByTarget = new Map<string, number>()

  operations.forEach((operation, index) => {
    if (isCheckinOperation(operation)) {
      latestByTarget.set(checkinTarget(operation), index)
    }
  })

  return operations.filter((operation, index) => {
    if (!isCheckinOperation(operation)) {
      return true
    }

    return latestByTarget.get(checkinTarget(operation)) === index
  })
}

/** Adds one operation and applies the collapse rule. */
export function enqueueOperation(
  operations: readonly SyncOperation[],
  operation: SyncOperation,
): SyncOperation[] {
  return collapseOperations([...operations, operation])
}

/** Number of changes not yet accepted by Supabase. */
export function pendingCount(snapshot: SyncSnapshot): number {
  return snapshot.pending.length
}

/** Appends failed operations to the queue for a manual retry. */
export function retryFailed(snapshot: SyncSnapshot): SyncSnapshot {
  return {
    pending: collapseOperations([
      ...snapshot.pending,
      ...snapshot.failed.map((failed) => failed.operation),
    ]),
    failed: [],
  }
}

/** Delay before a network retry. 1s, 2s, 4s, capped at 30s. */
export function retryDelayMs(retryCount: number): number {
  const exponent = Math.max(0, Math.min(retryCount, 5))

  return Math.min(30_000, 1_000 * 2 ** exponent)
}

export type SyncErrorKind = 'network' | 'auth' | 'permanent'

function fieldsOf(error: unknown): Record<string, unknown> {
  return typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : {}
}

function messageOf(error: unknown): string {
  const message = fieldsOf(error)['message']

  return typeof message === 'string' ? message.trim().toLowerCase() : ''
}

function codeOf(error: unknown): string {
  const code = fieldsOf(error)['code']

  return typeof code === 'string' || typeof code === 'number' ? String(code) : ''
}

function statusOf(error: unknown): number {
  const status = fieldsOf(error)['status']

  return typeof status === 'number' ? status : 0
}

/**
 * Decides whether to keep, pause or fail an operation.
 *
 * Network failures, timeouts, rate limits and 5xx failures are transient. Auth
 * failures are a pause: the queue must survive until the session is restored.
 * Everything else is a rule the server will keep rejecting, so it belongs in the
 * failed list where the user can see it.
 */
export function classifySyncError(error: unknown): SyncErrorKind {
  const message = messageOf(error)
  const code = codeOf(error)
  const status = statusOf(error)

  if (
    status >= 500 ||
    status === 408 ||
    status === 429 ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('network request failed') ||
    message.includes('load failed')
  ) {
    return 'network'
  }

  if (
    status === 401 ||
    // A plain 403 is an auth failure; `42501` is the RLS rule violation that
    // belongs in the permanent list instead.
    (status === 403 && code !== '42501') ||
    code === 'PGRST301' ||
    code === 'PGRST302' ||
    message.includes('jwt expired') ||
    message.includes('invalid jwt') ||
    message.includes('refresh token') ||
    message.includes('auth session missing') ||
    message.includes('not authenticated')
  ) {
    return 'auth'
  }

  return 'permanent'
}

/** The sentence shown once when one operation is moved to the failed list. */
export function operationFailureMessage(operation: SyncOperation, error: unknown): string {
  const fallback = isCheckinOperation(operation)
    ? 'Could not sync that check-in.'
    : 'Could not sync that habit.'

  return databaseErrorMessage(error, fallback)
}

export type DrainResult =
  | {
      outcome: 'drained'
      pending: []
      failed: FailedOperation[]
    }
  | {
      outcome: 'network'
      pending: SyncOperation[]
      failed: FailedOperation[]
      error: unknown
    }
  | {
      outcome: 'auth'
      pending: SyncOperation[]
      failed: FailedOperation[]
      error: unknown
    }

export interface DrainOptions {
  pending: readonly SyncOperation[]
  failed: readonly FailedOperation[]
  execute: (operation: SyncOperation) => Promise<void>
  classify?: (error: unknown) => SyncErrorKind
  /** Injected clock, so failure timestamps are deterministic in tests. */
  now?: () => string
}

/**
 * Replays the queue from the front until it is empty or a stop condition wins.
 *
 * A permanent failure is moved to the side and replay continues, so one bad
 * habit does not block every check-in behind it. Network and auth stops keep
 * the operation in place, in the same position, for the next attempt.
 */
export async function drainQueue({
  pending: initialPending,
  failed: initialFailed,
  execute,
  classify = classifySyncError,
  now = () => new Date().toISOString(),
}: DrainOptions): Promise<DrainResult> {
  let pending = [...initialPending]
  let failed = [...initialFailed]

  while (pending.length > 0) {
    const operation = pending[0]

    if (operation === undefined) {
      break
    }

    try {
      await execute(operation)
      pending = pending.slice(1)
    } catch (error) {
      const kind = classify(error)

      if (kind === 'network') {
        pending[0] = { ...operation, retryCount: operation.retryCount + 1 }
        return { outcome: 'network', pending, failed, error }
      }

      if (kind === 'auth') {
        return { outcome: 'auth', pending, failed, error }
      }

      failed = [
        ...failed,
        {
          operation,
          message: operationFailureMessage(operation, error),
          failedAt: now(),
          notified: false,
        },
      ]
      pending = pending.slice(1)
    }
  }

  return { outcome: 'drained', pending: [], failed }
}

/** Builds an add/remove operation with the shared fields filled in. */
export function checkinOperation(
  kind: 'add' | 'remove',
  input: {
    id: string
    userId: string
    habitId: string
    date: DateString
    checkinId: string
    createdAt: string
  },
): AddCheckinOperation | RemoveCheckinOperation {
  const base = {
    id: input.id,
    userId: input.userId,
    createdAt: input.createdAt,
    retryCount: 0,
  }

  return kind === 'add'
    ? {
        ...base,
        kind: 'add_checkin',
        habitId: input.habitId,
        date: input.date,
        checkinId: input.checkinId,
      }
    : { ...base, kind: 'remove_checkin', habitId: input.habitId, date: input.date }
}
