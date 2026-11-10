import { describe, expect, it } from 'vitest'

import { writeOrQueue } from './write'

function errorWith(message: string, fields: Record<string, unknown> = {}): Error {
  return Object.assign(new Error(message), fields)
}

describe('writeOrQueue', () => {
  it('sends normally when online and leaves the queue alone', async () => {
    let writes = 0
    let queued = 0

    const outcome = await writeOrQueue({
      write: () => {
        writes += 1
        return Promise.resolve()
      },
      enqueue: () => {
        queued += 1
        return Promise.resolve()
      },
      isOnline: () => true,
    })

    expect(outcome).toBe('sent')
    expect(writes).toBe(1)
    expect(queued).toBe(0)
  })

  it('queues without attempting the network while offline', async () => {
    let writes = 0
    let queued = 0

    const outcome = await writeOrQueue({
      write: () => {
        writes += 1
        return Promise.resolve()
      },
      enqueue: () => {
        queued += 1
        return Promise.resolve()
      },
      isOnline: () => false,
    })

    expect(outcome).toBe('queued')
    expect(writes).toBe(0)
    expect(queued).toBe(1)
  })

  it('queues a network failure instead of throwing', async () => {
    let queued = 0

    const outcome = await writeOrQueue({
      write: () => Promise.reject(new TypeError('Failed to fetch')),
      enqueue: () => {
        queued += 1
        return Promise.resolve()
      },
      isOnline: () => true,
    })

    expect(outcome).toBe('queued')
    expect(queued).toBe(1)
  })

  it('queues an auth failure so the item survives until sign-in', async () => {
    let queued = 0

    const outcome = await writeOrQueue({
      write: () => Promise.reject(errorWith('JWT expired', { status: 401 })),
      enqueue: () => {
        queued += 1
        return Promise.resolve()
      },
      isOnline: () => true,
    })

    expect(outcome).toBe('queued')
    expect(queued).toBe(1)
  })

  it('rethrows a permanent failure so the caller can roll back', async () => {
    const error = errorWith('check constraint violated', { code: '23514' })
    let queued = 0

    await expect(
      writeOrQueue({
        write: () => Promise.reject(error),
        enqueue: () => {
          queued += 1
          return Promise.resolve()
        },
        isOnline: () => true,
      }),
    ).rejects.toBe(error)

    expect(queued).toBe(0)
  })
})
