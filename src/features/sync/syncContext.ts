import { createContext } from 'react'

import type { SyncOperation } from '@/lib/sync/types'
import type { SyncStatus } from '@/lib/sync/engine'

export interface SyncContextValue {
  /** True once this user's saved queue has been loaded. */
  ready: boolean
  status: SyncStatus
  pendingCount: number
  failedCount: number
  enqueue: (operation: SyncOperation) => Promise<void>
  retry: () => void
}

export const SyncContext = createContext<SyncContextValue | null>(null)
