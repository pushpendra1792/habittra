/**
 * The replay loop around the pure queue.
 *
 * It owns three pieces of runtime state the pure functions deliberately do not:
 * a retry timer, the online flag, and the pause that follows an expired
 * session. Every change is written to IndexedDB before it is reported to the
 * UI, so a reload cannot silently forget a queued tap.
 */
import { classifySyncError, drainQueue, enqueueOperation, retryDelayMs, retryFailed } from './queue'
import {
  emptySyncSnapshot,
  type FailedOperation,
  type SyncOperation,
  type SyncSnapshot,
} from './types'

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error'

export interface SyncState {
  status: SyncStatus
  pendingCount: number
  failedCount: number
}

export interface SyncStorage {
  load: () => Promise<SyncSnapshot>
  save: (snapshot: SyncSnapshot) => Promise<void>
}

export interface SyncEngineOptions {
  storage: SyncStorage
  execute: (operation: SyncOperation) => Promise<void>
  /** Reads the browser's connection flag, injected so the engine is not tied to `window`. */
  isOnline: () => boolean
  onState: (state: SyncState) => void
  /** Called once per permanently failed operation, after it is saved. */
  onFailed: (failed: FailedOperation) => void
  /** Called when a pass finishes with nothing left in the queue. */
  onDrained?: () => void
}

function report(error: unknown, message: string): void {
  if (import.meta.env.DEV) {
    console.error(message, error)
  }
}

export class SyncEngine {
  private snapshot: SyncSnapshot = emptySyncSnapshot()
  private running = false
  private paused = false
  private networkDown = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private disposed = { value: false }

  private readonly options: SyncEngineOptions

  constructor(options: SyncEngineOptions) {
    this.options = options
  }

  async start(): Promise<void> {
    try {
      this.snapshot = await this.options.storage.load()
    } catch (error) {
      report(error, '[offline] could not read the queue')
    }

    if (this.isDisposed()) {
      return
    }

    await this.notifyFailed()
    this.emit()

    if (this.options.isOnline() && this.snapshot.pending.length > 0) {
      void this.run()
    }
  }

  async enqueue(operation: SyncOperation): Promise<void> {
    this.snapshot = {
      ...this.snapshot,
      pending: enqueueOperation(this.snapshot.pending, operation),
    }

    await this.persist()
    this.emit()

    if (this.options.isOnline()) {
      void this.run()
    }
  }

  /** A manual retry from the header. Failed items get another chance. */
  async retry(): Promise<void> {
    this.snapshot = retryFailed(this.snapshot)
    this.paused = false
    this.networkDown = false
    this.clearTimer()

    await this.persist()
    this.emit()

    if (this.options.isOnline()) {
      void this.run()
    }
  }

  /** Called by the provider on the browser's online/offline events. */
  setOnline(online: boolean): void {
    if (online) {
      this.networkDown = false
      this.clearTimer()

      if (this.snapshot.pending.length > 0 && !this.paused) {
        void this.run()
      }
    } else {
      this.networkDown = true
      this.clearTimer()
    }

    this.emit()
  }

  dispose(): void {
    this.disposed.value = true
    this.clearTimer()
  }

  private async run(): Promise<void> {
    if (this.running || this.isDisposed() || this.paused) {
      return
    }

    if (!this.options.isOnline()) {
      this.networkDown = true
      this.emit()
      return
    }

    this.running = true
    this.clearTimer()
    this.emit()

    const pendingAtStart = this.snapshot.pending
    const startedIds = new Set(pendingAtStart.map((operation) => operation.id))

    const result = await drainQueue({
      pending: pendingAtStart,
      failed: this.snapshot.failed,
      execute: this.options.execute,
      classify: classifySyncError,
    })

    this.running = false

    if (this.isDisposed()) {
      return
    }

    // An operation enqueued while the network calls were in flight was not in
    // the snapshot the drain saw. It must not be overwritten by the result.
    const addedDuringRun = this.snapshot.pending.filter(
      (operation) => !startedIds.has(operation.id),
    )

    this.snapshot = {
      pending: [...result.pending, ...addedDuringRun],
      failed: result.failed,
    }

    if (result.outcome === 'network') {
      this.networkDown = true
      // The failed operation was incremented once before the result came back,
      // so subtract that attempt to make the first wait one second, not two.
      const delay = retryDelayMs((result.pending[0]?.retryCount ?? 1) - 1)
      this.timer = setTimeout(() => {
        this.timer = null
        void this.run()
      }, delay)
    } else if (result.outcome === 'auth') {
      this.paused = true
      this.networkDown = false
    } else {
      this.networkDown = false
    }

    await this.notifyFailed()
    await this.persist()
    this.emit()

    if (result.outcome === 'drained' && this.snapshot.pending.length === 0) {
      this.options.onDrained?.()
    } else if (
      result.outcome === 'drained' &&
      this.snapshot.pending.length > 0 &&
      this.options.isOnline()
    ) {
      void this.run()
    }
  }

  /** Marks and emits the one toast each failed operation is allowed. */
  private async notifyFailed(): Promise<void> {
    const fresh = this.snapshot.failed.filter((failed) => !failed.notified)

    if (fresh.length === 0) {
      return
    }

    this.snapshot = {
      ...this.snapshot,
      failed: this.snapshot.failed.map((failed) =>
        failed.notified ? failed : { ...failed, notified: true },
      ),
    }

    for (const failed of fresh) {
      try {
        this.options.onFailed(failed)
      } catch (error) {
        report(error, '[offline] could not announce a failed sync')
      }
    }

    await this.persist()
  }

  private async persist(): Promise<void> {
    try {
      await this.options.storage.save(this.snapshot)
    } catch (error) {
      report(error, '[offline] could not save the queue')
    }
  }

  private isDisposed(): boolean {
    return this.disposed.value
  }

  private emit(): void {
    if (this.isDisposed()) {
      return
    }

    const pendingCount = this.snapshot.pending.length
    const failedCount = this.snapshot.failed.length

    let status: SyncStatus = 'synced'

    if (this.paused || failedCount > 0) {
      status = 'error'
    } else if (!this.options.isOnline() || this.networkDown) {
      status = 'offline'
    } else if (this.running) {
      status = 'syncing'
    }

    this.options.onState({ status, pendingCount, failedCount })
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
