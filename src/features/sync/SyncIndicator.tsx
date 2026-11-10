/**
 * The quiet sync indicator in the header.
 *
 * It only reports; it never opens a dialog. The one interactive state is a
 * permanent failure or an expired session, where tapping asks the engine to try
 * the failed operations again. Everything else is plain status text so it can
 * sit beside Sign out without becoming a second destination.
 */
import type { SyncStatus } from '@/lib/sync/engine'

import { useSync } from './useSync'

const DOT_CLASS: Record<SyncStatus, string> = {
  synced: 'bg-accent-teal',
  syncing: 'bg-accent-blue animate-pulse',
  offline: 'bg-accent-yellow',
  error: 'bg-accent-coral',
}

function label(status: SyncStatus, pendingCount: number): string {
  if (status === 'offline') {
    return `Offline · ${pendingCount}`
  }

  if (status === 'syncing') {
    return 'Syncing'
  }

  return 'Synced'
}

export function SyncIndicator() {
  const { status, pendingCount, failedCount, retry } = useSync()

  if (status === 'error') {
    return (
      <button
        type="button"
        onClick={retry}
        aria-label={failedCount > 0 ? `Retry sync, ${failedCount} failed changes` : 'Retry sync'}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-pill border border-border-dark px-2.5 text-xs text-text-muted-on-dark transition-colors hover:border-text-muted-on-dark/40 hover:text-text-on-dark"
      >
        <span className={`size-2 shrink-0 rounded-pill ${DOT_CLASS.error}`} aria-hidden="true" />
        <span>Sync error</span>
        <span className="text-text-on-dark">Retry</span>
      </button>
    )
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="inline-flex shrink-0 items-center gap-1.5 text-xs text-text-muted-on-dark"
    >
      <span className={`size-2 shrink-0 rounded-pill ${DOT_CLASS[status]}`} aria-hidden="true" />
      <span>{label(status, pendingCount)}</span>
    </div>
  )
}
