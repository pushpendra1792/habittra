import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

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

interface Harness {
  queryClient: QueryClient
  rollbacks: unknown[]
  options: ReturnType<typeof toggleCheckinMutation>
}

function harness(seed: Checkin[] | undefined): Harness {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  if (seed !== undefined) {
    queryClient.setQueryData(KEY, seed)
  }

  const rollbacks: unknown[] = []
  const options = toggleCheckinMutation({
    monthKey: MONTH,
    userId: 'user-test',
    queryClient,
    onRollback: (error) => {
      rollbacks.push(error)
    },
  })

  return { queryClient, rollbacks, options }
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
