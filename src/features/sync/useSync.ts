import { useContext } from 'react'

import { SyncContext, type SyncContextValue } from './syncContext'

/** The offline queue's status and the two actions the app uses. */
export function useSync(): SyncContextValue {
  const context = useContext(SyncContext)

  if (context === null) {
    throw new Error('useSync must be used inside a SyncProvider')
  }

  return context
}
