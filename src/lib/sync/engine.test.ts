import { afterEach, describe, expect, it, vi } from 'vitest'

import { SyncEngine, type SyncState, type SyncStorage } from './engine'
import {
  emptySyncSnapshot,
  type FailedOperation,
  type SyncOperation,
  type SyncSnapshot,
} from './types'

const CREATED_AT = '2026-11-10T09:00:00.000Z'

function addCheckin(id: string): SyncOperation {
  return {
    id,
    userId: 'user-test',
    createdAt: CREATED_AT,
    retryCount: 0,
    kind: 'add_checkin',
    habitId: 'habit-1',
    date: '2026-11-01',
    checkinId: `checkin-${id}`,
  }
}

function errorWith(message: string, fields: Record<string, unknown> = {}): Error {
  return Object.assign(new Error(message), fields)
}

function clone(snapshot: SyncSnapshot): SyncSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as SyncSnapshot
}

interface HarnessOptions {
  online?: boolean
  snapshot?: SyncSnapshot
  execute?: (operation: SyncOperation) => Promise<void>
  storage?: SyncStorage
}

function harness(options: HarnessOptions = {}) {
  const saved = { current: options.snapshot ?? emptySyncSnapshot() }
  const storage: SyncStorage = options.storage ?? {
    load: () => Promise.resolve(clone(saved.current)),
    save: (snapshot) => {
      saved.current = clone(snapshot)

      return Promise.resolve()
    },
  }
  const states: SyncState[] = []
  const failed: FailedOperation[] = []
  const execute = vi.fn(options.execute ?? (() => Promise.resolve()))
  const online = { value: options.online ?? true }

  const engine = new SyncEngine({
    storage,
    execute,
    isOnline: () => online.value,
    onState: (state) => {
      states.push(state)
    },
    onFailed: (entry) => {
      failed.push(entry)
    },
  })

  return { engine, execute, states, failed, saved, online, storage }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('SyncEngine', () => {
  it('replays a saved queue on start and reports synced when it empties', async () => {
    const { engine, execute, saved, states } = harness({
      snapshot: { pending: [addCheckin('one')], failed: [] },
    })

    await engine.start()

    await vi.waitFor(() => {
      expect(saved.current.pending).toHaveLength(0)
    })

    expect(execute).toHaveBeenCalledTimes(1)
    expect(states.at(-1)).toEqual({ status: 'synced', pendingCount: 0, failedCount: 0 })

    engine.dispose()
  })

  it('keeps an offline operation and reports the pending count without calling the network', async () => {
    const { engine, execute, saved, states } = harness({ online: false })

    await engine.start()
    await engine.enqueue(addCheckin('offline'))

    expect(execute).not.toHaveBeenCalled()
    expect(saved.current.pending).toHaveLength(1)
    expect(states.at(-1)).toEqual({ status: 'offline', pendingCount: 1, failedCount: 0 })

    engine.dispose()
  })

  it('pauses on an auth failure and resumes on a manual retry', async () => {
    const execute = vi
      .fn<(operation: SyncOperation) => Promise<void>>()
      .mockRejectedValueOnce(errorWith('JWT expired', { status: 401 }))
      .mockResolvedValue(undefined)
    const { engine, saved, states } = harness({
      snapshot: { pending: [addCheckin('one')], failed: [] },
      execute,
    })

    await engine.start()

    await vi.waitFor(() => {
      expect(states.at(-1)?.status).toBe('error')
    })

    expect(saved.current.pending).toHaveLength(1)
    expect(saved.current.pending[0]?.retryCount).toBe(0)

    await engine.retry()

    await vi.waitFor(() => {
      expect(saved.current.pending).toHaveLength(0)
    })

    expect(execute).toHaveBeenCalledTimes(2)

    engine.dispose()
  })

  it('announces a permanent failure once and remembers the announcement across a reload', async () => {
    const execute = vi
      .fn<(operation: SyncOperation) => Promise<void>>()
      .mockRejectedValue(errorWith('check constraint violated', { code: '23514' }))
    const first = harness({
      snapshot: { pending: [addCheckin('bad')], failed: [] },
      execute,
    })

    await first.engine.start()

    await vi.waitFor(() => {
      expect(first.failed).toHaveLength(1)
      expect(first.saved.current.failed[0]?.notified).toBe(true)
    })

    expect(first.saved.current.pending).toHaveLength(0)
    expect(first.states.at(-1)).toMatchObject({ status: 'error', failedCount: 1 })

    first.engine.dispose()

    const second = harness({ storage: first.storage })
    await second.engine.start()

    expect(second.failed).toHaveLength(0)
    expect(second.execute).not.toHaveBeenCalled()

    second.engine.dispose()
  })

  it('waits one second, then two, before retrying a network failure', async () => {
    vi.useFakeTimers()

    const execute = vi
      .fn<(operation: SyncOperation) => Promise<void>>()
      .mockRejectedValue(new TypeError('Failed to fetch'))
    const { engine, states } = harness({
      snapshot: { pending: [addCheckin('one')], failed: [] },
      execute,
    })

    await engine.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(execute).toHaveBeenCalledTimes(1)
    expect(states.at(-1)).toMatchObject({ status: 'offline', pendingCount: 1 })

    await vi.advanceTimersByTimeAsync(999)
    expect(execute).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    expect(execute).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(1_999)
    expect(execute).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(1)
    expect(execute).toHaveBeenCalledTimes(3)

    engine.dispose()
  })
})
