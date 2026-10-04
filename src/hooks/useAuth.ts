import { useContext } from 'react'

import { AuthContext, type AuthContextValue } from '@/features/auth/authContext'

/**
 * The session, and every way of changing it.
 *
 * Requires an AuthProvider above the caller. `status` is what a gate should read:
 * `loading` until Supabase has answered, then `authenticated`, `anonymous` or
 * `unconfigured`.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (context === null) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }

  return context
}
