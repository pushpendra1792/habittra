/**
 * One write, with the queue as its fallback.
 *
 * The online path is deliberately first and unchanged: a permanent rule
 * violation still throws so the caller can roll the optimistic cache back. A
 * network or auth failure is not a reason to lose the user's tap, so that path
 * appends the operation and resolves as success.
 */
import { classifySyncError } from './queue'

export type WriteOutcome = 'sent' | 'queued'

export interface WriteOrQueueOptions {
  write: () => Promise<unknown>
  enqueue: () => Promise<void>
  isOnline: () => boolean
}

export async function writeOrQueue({
  write,
  enqueue,
  isOnline,
}: WriteOrQueueOptions): Promise<WriteOutcome> {
  if (!isOnline()) {
    await enqueue()

    return 'queued'
  }

  try {
    await write()

    return 'sent'
  } catch (error) {
    if (classifySyncError(error) === 'permanent') {
      throw error
    }

    await enqueue()

    return 'queued'
  }
}
