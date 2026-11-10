import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { habitListKey } from '@/features/tracker/trackerQueries'
import { SyncEngine, type SyncState } from '@/lib/sync/engine'
import { executeSyncOperation } from '@/lib/sync/execute'
import { readSyncSnapshot, writeSyncSnapshot } from '@/lib/sync/localCache'
import type { SyncOperation } from '@/lib/sync/types'

import { SyncContext } from './syncContext'

export interface SyncProviderProps {
  children?: ReactNode
}

interface ProviderState extends SyncState {
  userId: string | null
  ready: boolean
}

const INITIAL: ProviderState = {
  userId: null,
  ready: false,
  status: 'synced',
  pendingCount: 0,
  failedCount: 0,
}

function idleState(userId: string | null): ProviderState {
  return {
    userId,
    ready: userId === null,
    status: 'synced',
    pendingCount: 0,
    failedCount: 0,
  }
}

/**
 * Runs the saved queue for the signed-in user.
 *
 * The engine is per user and is disposed when the account changes, so an old
 * account's timer cannot write into the new account's queue. Loading the queue
 * is part of `ready`: a tap made before that read finished could otherwise be
 * saved over the old snapshot.
 */
export function SyncProvider({ children }: SyncProviderProps) {
  const { userId } = useAuth()
  const { push } = useToast()
  const queryClient = useQueryClient()
  const engineRef = useRef<SyncEngine | null>(null)
  const [state, setState] = useState<ProviderState>(INITIAL)

  if (state.userId !== userId) {
    setState(idleState(userId))
  }

  useEffect(() => {
    const lifecycle = { active: true }

    if (userId === null) {
      engineRef.current?.dispose()
      engineRef.current = null
      return
    }

    const engine = new SyncEngine({
      storage: {
        load: () => readSyncSnapshot(userId),
        save: (snapshot) => writeSyncSnapshot(userId, snapshot),
      },
      execute: executeSyncOperation,
      isOnline: () => navigator.onLine,
      onState: (next) => {
        setState((current) => (current.userId === userId ? { ...current, ...next } : current))
      },
      onFailed: (failed) => {
        push({ message: failed.message })
      },
      onDrained: () => {
        void queryClient.invalidateQueries({ queryKey: habitListKey })
        void queryClient.invalidateQueries({ queryKey: ['checkins'] })
      },
    })

    engineRef.current = engine

    const online = () => {
      engine.setOnline(true)
    }
    const offline = () => {
      engine.setOnline(false)
    }

    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    engine.setOnline(navigator.onLine)

    void (async () => {
      try {
        await engine.start()
      } finally {
        if (lifecycle.active) {
          setState((current) => (current.userId === userId ? { ...current, ready: true } : current))
        }
      }
    })()

    return () => {
      lifecycle.active = false
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      engine.dispose()

      if (engineRef.current === engine) {
        engineRef.current = null
      }
    }
  }, [push, queryClient, userId])

  const enqueue = useCallback((operation: SyncOperation) => {
    const engine = engineRef.current

    if (engine === null) {
      return Promise.reject(new Error('The offline queue is not ready yet.'))
    }

    return engine.enqueue(operation)
  }, [])

  const retry = useCallback(() => {
    void engineRef.current?.retry()
  }, [])

  const value = useMemo(
    () => ({
      ready: state.ready,
      status: state.status,
      pendingCount: state.pendingCount,
      failedCount: state.failedCount,
      enqueue,
      retry,
    }),
    [enqueue, retry, state.failedCount, state.pendingCount, state.ready, state.status],
  )

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
}
