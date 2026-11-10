import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/hooks/useAuth'

import { LocalCacheContext } from './localCacheContext'
import { hydrateTrackerCache, persistTrackerCache } from './localCacheSync'

export interface LocalCacheProviderProps {
  children?: ReactNode
}

/**
 * Loads the local snapshot before the tracker mounts.
 *
 * The gate is the user id rather than a boolean: a browser can switch accounts
 * without a full reload, and the moment the id changes the old query data must
 * not be allowed to paint for the new account. Login and sign-up screens are
 * not gated; only ProtectedRoute waits for `ready`.
 */
export function LocalCacheProvider({ children }: LocalCacheProviderProps) {
  const { userId } = useAuth()
  const queryClient = useQueryClient()
  // Keyed by user so returning to an account after signing out cannot show the
  // previous hydration as ready. Adjusting state during render is React's
  // supported way to reset derived state when an input changes.
  const [hydration, setHydration] = useState<{ userId: string | null; ready: boolean }>({
    userId: null,
    ready: false,
  })

  if (hydration.userId !== userId) {
    setHydration({ userId, ready: false })
  }

  useEffect(() => {
    const lifecycle = { active: true }
    let stopPersisting: (() => void) | undefined

    queryClient.clear()

    if (userId === null) {
      return
    }

    void (async () => {
      try {
        await hydrateTrackerCache(queryClient, userId, () => lifecycle.active)
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('[offline] could not read local cache', error)
        }
      }

      if (!lifecycle.active) {
        return
      }

      stopPersisting = persistTrackerCache(queryClient, userId)
      setHydration({ userId, ready: true })
    })()

    return () => {
      lifecycle.active = false
      stopPersisting?.()
    }
  }, [queryClient, userId])

  const ready = userId === null || (hydration.userId === userId && hydration.ready)
  const value = useMemo(() => ({ ready }), [ready])

  return <LocalCacheContext.Provider value={value}>{children}</LocalCacheContext.Provider>
}
