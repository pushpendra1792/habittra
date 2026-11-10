import { describe, expect, it } from 'vitest'

import { TEST_USER_ID } from '@/test/factories'

import {
  checkinOperation,
  classifySyncError,
  collapseOperations,
  drainQueue,
  enqueueOperation,
  operationFailureMessage,
  retryDelayMs,
  retryFailed,
} from './queue'
import type {
  AddCheckinOperation,
  CreateHabitOperation,
  FailedOperation,
  RemoveCheckinOperation,
  SyncOperation,
  UpdateHabitOperation,
} from './types'

const CREATED_AT = '2026-11-10T09:00:00.000Z'

function add(overrides: Partial<AddCheckinOperation> = {}): AddCheckinOperation {
  return {
    id: overrides.id ?? 'op-add',
    userId: TEST_USER_ID,
    createdAt: overrides.createdAt ?? CREATED_AT,
    retryCount: 0,
    kind: 'add_checkin',
    habitId: overrides.habitId ?? 'habit-1',
    date: overrides.date ?? '2026-11-01',
    checkinId: overrides.checkinId ?? 'checkin-1',
  }
}

function remove(overrides: Partial<RemoveCheckinOperation> = {}): RemoveCheckinOperation {
  return {
    id: overrides.id ?? 'op-remove',
    userId: TEST_USER_ID,
    createdAt: overrides.createdAt ?? CREATED_AT,
    retryCount: 0,
    kind: 'remove_checkin',
    habitId: overrides.habitId ?? 'habit-1',
    date: overrides.date ?? '2026-11-01',
  }
}

function create(overrides: Partial<CreateHabitOperation> = {}): CreateHabitOperation {
  return {
    id: overrides.id ?? 'op-create',
    userId: TEST_USER_ID,
    createdAt: overrides.createdAt ?? CREATED_AT,
    retryCount: 0,
    kind: 'create_habit',
    habit: overrides.habit ?? {
      id: 'habit-offline',
      name: 'Walk',
      monthlyGoal: 10,
      color: 'teal',
      sortOrder: 0,
    },
  }
}

function update(overrides: Partial<UpdateHabitOperation> = {}): UpdateHabitOperation {
  return {
    id: overrides.id ?? 'op-update',
    userId: TEST_USER_ID,
    createdAt: overrides.createdAt ?? CREATED_AT,
    retryCount: 0,
    kind: 'update_habit',
    habitId: overrides.habitId ?? 'habit-1',
    patch: overrides.patch ?? { name: 'Renamed' },
  }
}

function failed(operation: SyncOperation): FailedOperation {
  return {
    operation,
    message: 'Could not sync that change.',
    failedAt: CREATED_AT,
    notified: true,
  }
}

function operationError(message: string, fields: Record<string, unknown>): Error {
  return Object.assign(new Error(message), fields)
}

describe('collapseOperations', () => {
  it('keeps only the final answer for one habit on one day', () => {
    const operations = [add({ id: 'first' }), remove({ id: 'last' })]

    expect(collapseOperations(operations)).toEqual([remove({ id: 'last' })])
  })

  it('keeps a later add when remove came first', () => {
    const operations = [remove({ id: 'first' }), add({ id: 'last', checkinId: 'latest-checkin' })]

    const result = collapseOperations(operations)

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'last',
      kind: 'add_checkin',
      checkinId: 'latest-checkin',
    })
  })

  it('does not collapse a different habit or a different day', () => {
    const operations = [
      add({ id: 'a', habitId: 'habit-1', date: '2026-11-01' }),
      add({ id: 'b', habitId: 'habit-2', date: '2026-11-01' }),
      add({ id: 'c', habitId: 'habit-1', date: '2026-11-02' }),
    ]

    expect(collapseOperations(operations)).toHaveLength(3)
  })

  it('keeps the latest operation in its later queue position', () => {
    const operations = [
      add({ id: 'a', habitId: 'habit-1', date: '2026-11-01' }),
      add({ id: 'b', habitId: 'habit-2', date: '2026-11-01' }),
      remove({ id: 'c', habitId: 'habit-1', date: '2026-11-01' }),
    ]

    expect(collapseOperations(operations).map((operation) => operation.id)).toEqual(['b', 'c'])
  })

  it('leaves habit operations and ordering untouched', () => {
    const operations = [create(), add(), update()]

    expect(collapseOperations(operations)).toEqual(operations)
  })

  it('keeps an offline create ahead of its check-in', () => {
    const operations = enqueueOperation(enqueueOperation([], create()), add())

    expect(operations.map((operation) => operation.kind)).toEqual(['create_habit', 'add_checkin'])
  })
})

describe('enqueueOperation', () => {
  it('appends a new operation', () => {
    const queue = enqueueOperation([], add())

    expect(queue.map((operation) => operation.id)).toEqual(['op-add'])
  })

  it('collapses the same cell as it grows', () => {
    const queue = enqueueOperation(enqueueOperation([], add()), remove())

    expect(queue).toHaveLength(1)
    expect(queue[0]?.kind).toBe('remove_checkin')
  })
})

describe('retryDelayMs', () => {
  it('backs off from one second and caps at thirty', () => {
    expect(retryDelayMs(0)).toBe(1_000)
    expect(retryDelayMs(1)).toBe(2_000)
    expect(retryDelayMs(2)).toBe(4_000)
    expect(retryDelayMs(9)).toBe(30_000)
  })
})

describe('classifySyncError', () => {
  it('treats a failed fetch as a network problem', () => {
    expect(classifySyncError(new TypeError('Failed to fetch'))).toBe('network')
    expect(classifySyncError({ message: 'NetworkError when attempting to fetch resource.' })).toBe(
      'network',
    )
  })

  it('keeps retrying server failures', () => {
    expect(classifySyncError({ status: 503, message: 'Service unavailable' })).toBe('network')
  })

  it('pauses on auth failures', () => {
    expect(classifySyncError({ status: 401, message: 'JWT expired' })).toBe('auth')
    expect(classifySyncError({ code: 'PGRST301', message: 'JWT expired' })).toBe('auth')
  })

  it('fails rule violations and missing parents', () => {
    expect(classifySyncError({ code: '23514', message: 'check constraint violated' })).toBe(
      'permanent',
    )
    expect(classifySyncError({ code: '23503', message: 'foreign key violated' })).toBe('permanent')
    expect(classifySyncError({ status: 403, code: '42501' })).toBe('permanent')
  })
})

describe('drainQueue', () => {
  it('replays operations in order', async () => {
    const operations = [create(), add(), update()]
    const seen: string[] = []

    const result = await drainQueue({
      pending: operations,
      failed: [],
      execute: (operation) => {
        seen.push(operation.id)
        return Promise.resolve()
      },
    })

    expect(seen).toEqual(['op-create', 'op-add', 'op-update'])
    expect(result.outcome).toBe('drained')
    expect(result.pending).toEqual([])
  })

  it('keeps a network failure and increases its retry count', async () => {
    const operations = [add({ id: 'first' }), add({ id: 'second', habitId: 'habit-2' })]
    const error = new TypeError('Failed to fetch')

    const result = await drainQueue({
      pending: operations,
      failed: [],
      execute: (operation) => {
        if (operation.id === 'first') {
          throw error
        }

        return Promise.resolve()
      },
    })

    expect(result.outcome).toBe('network')
    expect(result.pending.map((operation) => operation.id)).toEqual(['first', 'second'])
    expect(result.pending[0]?.retryCount).toBe(1)
    expect(result.failed).toEqual([])
  })

  it('pauses on auth failures without incrementing or dropping anything', async () => {
    const operations = [add({ id: 'first' })]
    const error = operationError('JWT expired', { status: 401 })

    const result = await drainQueue({
      pending: operations,
      failed: [],
      execute: () => {
        throw error
      },
    })

    expect(result.outcome).toBe('auth')
    expect(result.pending[0]?.retryCount).toBe(0)
    expect(result.pending).toHaveLength(1)
  })

  it('moves a permanent failure aside and keeps replaying', async () => {
    const bad = add({ id: 'bad' })
    const good = add({ id: 'good', habitId: 'habit-2' })
    const seen: string[] = []

    const result = await drainQueue({
      pending: [bad, good],
      failed: [],
      execute: (operation) => {
        seen.push(operation.id)

        if (operation.id === 'bad') {
          throw operationError('check constraint violated', { code: '23514' })
        }

        return Promise.resolve()
      },
      now: () => '2026-11-10T10:00:00.000Z',
    })

    expect(seen).toEqual(['bad', 'good'])
    expect(result.outcome).toBe('drained')
    expect(result.pending).toEqual([])
    expect(result.failed).toHaveLength(1)
    expect(result.failed[0]).toMatchObject({
      operation: { id: 'bad' },
      failedAt: '2026-11-10T10:00:00.000Z',
      notified: false,
    })
  })

  it('keeps the existing failed list when another operation fails', async () => {
    const previous = failed(add({ id: 'old' }))

    const result = await drainQueue({
      pending: [add({ id: 'new' })],
      failed: [previous],
      execute: () => {
        throw operationError('foreign key violated', { code: '23503' })
      },
    })

    expect(result.failed.map((entry) => entry.operation.id)).toEqual(['old', 'new'])
  })
})

describe('retryFailed', () => {
  it('puts failed operations back in the queue and collapses check-ins', () => {
    const snapshot = retryFailed({
      pending: [add({ id: 'pending', habitId: 'habit-2' })],
      failed: [
        failed(remove({ id: 'failed-remove' })),
        failed(update({ id: 'failed-habit', habitId: 'habit-3', patch: { archived: true } })),
      ],
    })

    expect(snapshot.failed).toEqual([])
    expect(snapshot.pending.map((operation) => operation.id)).toEqual([
      'pending',
      'failed-remove',
      'failed-habit',
    ])
  })
})

describe('checkinOperation', () => {
  it('keeps the check-in id and date exactly as the tap created them', () => {
    const operation = checkinOperation('add', {
      id: 'queue-op',
      userId: TEST_USER_ID,
      habitId: 'habit-1',
      date: '2026-11-01',
      checkinId: 'checkin-client',
      createdAt: CREATED_AT,
    })

    expect(operation).toMatchObject({
      kind: 'add_checkin',
      date: '2026-11-01',
      checkinId: 'checkin-client',
      retryCount: 0,
    })
  })
})

describe('operationFailureMessage', () => {
  it('says what kind of operation failed', () => {
    expect(operationFailureMessage(add(), new Error('nope'))).toBe('Could not sync that check-in.')
    expect(operationFailureMessage(update(), new Error('nope'))).toBe('Could not sync that habit.')
  })
})
