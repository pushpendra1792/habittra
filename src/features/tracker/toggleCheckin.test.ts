import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import type { SyncOperation } from '@/lib/sync/types'
import { makeCheckin } from '@/test/factories'
import type { Checkin, MonthKey } from '@/types'

import { checkinsKey } from './trackerQueries'
import { toggleCheckinMutation, type ToggleCheckinVars } from './useToggleCheckin'

const MONTH: MonthKey = '2023-07'
const KEY = checkinsKey(MONTH)

function variables(overrides: Partial<ToggleCheckinVars> = {}): ToggleCheckinVars {
  return {
    habitId: 'habit-1',
    date: '2023-07-04',
    next: true,
    id: 'checkin-client-1',
    ...overrides,
  }
}

interface HarnessInput {
  isOnline?: boolean
  write?: (variables: ToggleCheckinVars) => Promise<void>
}

interface Harness {
  queryClient: QueryClient
  rollbacks: unknown[]
  queued: SyncOperation[]
  writes: ToggleCheckinVars[]
  options: ReturnType<typeof toggleCheckinMutation>
}

function harness(seed: Checkin[] | undefined, input: HarnessInput = {}): Harness {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  if (seed !== undefined) {
    queryClient.setQueryData(KEY, seed)
  }

  const rollbacks: unknown[] = []
  const queued: SyncOperation[] = []
  const writes: ToggleCheckinVars[] = []
  const write =
    input.write ??
    ((variables: ToggleCheckinVars) => {
      writes.push(variables)
      return Promise.resolve()
    })

  const options = toggleCheckinMutation({
    monthKey: MONTH,
    userId: 'user-test',
    queryClient,
    onRollback: (error) => {
      rollbacks.push(error)
    },
    enqueue: (operation) => {
      queued.push(operation)
      return Promise.resolve()
    },
    isOnline: () => input.isOnline ?? true,
    write,
  })

  return { queryClient, rollbacks, queued, writes, options }
}

function operationError(message: string, fields: Record<string, unknown>): Error {
  return Object.assign(new Error(message), fields)
}

describe('the optimistic check-in update', () => {
  it('changes the cache in onMutate, before the write has happened', async () => {
    const { queryClient, options } = harness([])
    const seed = queryClient.getQueryData<Checkin[]>(KEY)

    await options.onMutate(variables())

    const next = queryClient.getQueryData<Checkin[]>(KEY)

    expect(seed).toEqual([])
    expect(next).toHaveLength(1)
    expect(next?.[0]).toMatchObject({
      id: 'checkin-client-1',
      habitId: 'habit-1',
      date: '2023-07-04',
      userId: 'user-test',
    })
  })

  it('uses the id the caller generated, so a retry is the same row', async () => {
    const { queryClient, options } = harness([])

    await options.onMutate(variables({ id: 'checkin-queued-9' }))

    expect(queryClient.getQueryData<Checkin[]>(KEY)?.[0]?.id).toBe('checkin-queued-9')
  })

  it('removes the cell optimistically when the tap clears a day', async () => {
    const existing = makeCheckin({ habitId: 'habit-1', date: '2023-07-04' })
    const other = makeCheckin({ habitId: 'habit-1', date: '2023-07-05' })
    const { queryClient, options } = harness([existing, other])

    await options.onMutate(variables({ next: false }))

    expect(queryClient.getQueryData<Checkin[]>(KEY)).toEqual([other])
  })

  it('returns the previous list so the failure can put it back', async () => {
    const existing = makeCheckin({ habitId: 'habit-1', date: '2023-07-04' })
    const { options } = harness([existing])

    const context = await options.onMutate(variables({ next: false }))

    expect(context.previous).toEqual([existing])
  })

  it('starts from an empty month when nothing has been fetched yet', async () => {
    const { queryClient, options } = harness(undefined)

    await options.onMutate(variables())

    expect(queryClient.getQueryData<Checkin[]>(KEY)).toHaveLength(1)
  })
})

describe('the rollback', () => {
  it('puts the cache back exactly as it was and reports the failure', async () => {
    const existing = makeCheckin({ habitId: 'habit-1', date: '2023-07-01' })
    const { queryClient, rollbacks, options } = harness([existing])
    const error = new Error('network is down')

    const context = await options.onMutate(variables())
    expect(queryClient.getQueryData<Checkin[]>(KEY)).toHaveLength(2)

    options.onError(error, variables(), context)

    expect(queryClient.getQueryData<Checkin[]>(KEY)).toEqual([existing])
    expect(rollbacks).toEqual([error])
  })

  it('rolls back a cleared day as well as an added one', async () => {
    const existing = makeCheckin({ habitId: 'habit-1', date: '2023-07-04' })
    const { queryClient, options } = harness([existing])

    const context = await options.onMutate(variables({ next: false }))
    expect(queryClient.getQueryData<Checkin[]>(KEY)).toEqual([])

    options.onError(new Error('nope'), variables({ next: false }), context)

    expect(queryClient.getQueryData<Checkin[]>(KEY)).toEqual([existing])
  })

  it('falls back to an empty month when there was nothing to restore', async () => {
    const { queryClient, options } = harness(undefined)

    const context = await options.onMutate(variables())
    expect(context.previous).toEqual([])

    options.onError(new Error('nope'), variables(), context)

    expect(queryClient.getQueryData<Checkin[]>(KEY)).toEqual([])
  })

  it('still reports the failure when there is no context to restore', () => {
    const { rollbacks, options } = harness([])
    const error = new Error('failed')

    options.onError(error, variables(), undefined)

    expect(rollbacks).toEqual([error])
  })
})

describe('settling', () => {
  it('invalidates the month so the server has the last word', async () => {
    const { queryClient, options } = harness([])

    await options.onMutate(variables())
    options.onSettled(undefined, undefined, variables(), undefined)

    expect(queryClient.getQueryState(KEY)?.isInvalidated).toBe(true)
  })
})

describe('the write path', () => {
  it('sends normally when online and does not queue anything', async () => {
    const { queued, writes, options } = harness([])

    await options.mutationFn(variables())

    expect(writes).toHaveLength(1)
    expect(queued).toEqual([])
  })

  it('queues the same tap while offline without attempting the network', async () => {
    const { queued, writes, options } = harness([], { isOnline: false })

    await options.mutationFn(variables({ id: 'checkin-offline' }))

    expect(writes).toEqual([])
    expect(queued).toHaveLength(1)
    expect(queued[0]).toMatchObject({
      kind: 'add_checkin',
      habitId: 'habit-1',
      date: '2023-07-04',
      checkinId: 'checkin-offline',
      retryCount: 0,
    })
  })

  it('queues a network failure instead of rolling back', async () => {
    const error = new TypeError('Failed to fetch')
    const { queued, rollbacks, options } = harness([], {
      write: () => Promise.reject(error),
    })

    await expect(options.mutationFn(variables())).resolves.toBeUndefined()

    expect(queued).toHaveLength(1)
    expect(rollbacks).toEqual([])
  })

  it('queues a cleared day as a remove operation', async () => {
    const { queued, options } = harness([], { isOnline: false })

    await options.mutationFn(variables({ next: false }))

    expect(queued[0]).toMatchObject({
      kind: 'remove_checkin',
      habitId: 'habit-1',
      date: '2023-07-04',
    })
  })

  it('rethrows a permanent failure and leaves the queue empty', async () => {
    const error = operationError('check constraint violated', { code: '23514' })
    const { queued, options } = harness([], {
      write: () => Promise.reject(error),
    })

    await expect(options.mutationFn(variables())).rejects.toBe(error)

    expect(queued).toEqual([])
  })
})
