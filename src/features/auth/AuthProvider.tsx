/**
 * Holds the session and every way of changing it.
 *
 * One provider, mounted once inside the router. Screens call the methods here
 * rather than reaching for Supabase, which is what keeps "which call do I make
 * for this" in one file.
 *
 * Two things this deliberately does not do:
 *
 * It does not build the client at import time. A build made without Supabase keys
 * has to render, so the client is resolved inside the effect and a missing
 * variable becomes the `unconfigured` status rather than a blank page.
 *
 * It does not swallow failures. Every method throws the underlying Supabase
 * error; the screens turn it into something readable with `authErrorMessage`.
 * Whether a failure deserves a sentence of apology is a decision for the screen
 * that failed, not for the layer underneath it.
 */
import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  AuthContext,
  sessionUser,
  type AuthContextValue,
  type AuthStatus,
} from '@/features/auth/authContext'
import {
  isRecoveryUrl,
  passwordRecoveryRedirectUrl,
  signInRedirectUrl,
} from '@/features/auth/redirects'
import { getSupabaseClient, SupabaseConfigError } from '@/lib/supabase'

export interface AuthProviderProps {
  children?: ReactNode
}

interface AuthState {
  session: Session | null
  /** True once Supabase has answered, so `loading` is only shown while it has not. */
  resolved: boolean
  /** True when the session in hand came from a recovery link. */
  recovery: boolean
}

const initialState: AuthState = {
  session: null,
  resolved: false,
  recovery: false,
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>(initialState)

  // Resolved during render rather than in the effect below.
  //
  // Whether the environment has the two Supabase variables is a pure read, and
  // deciding it here means a missing variable is one render rather than two.
  // Setting it from inside the effect would also mean a second render pass
  // before anything could be shown, which is the cascade the effect would be
  // written to avoid.
  const unconfigured = useMemo(() => {
    try {
      getSupabaseClient()

      return false
    } catch (thrown) {
      if (thrown instanceof SupabaseConfigError) {
        return true
      }

      throw thrown
    }
  }, [])

  useEffect(() => {
    // StrictMode runs effects twice in development. Without this the first
    // subscription would leak and its late callbacks would set state on an
    // unmounted tree.
    let active = true

    if (unconfigured) {
      // Nothing to subscribe to. `status` already reads `unconfigured` from this
      // flag, so no state is set and no request is attempted.
      return
    }

    const supabase = getSupabaseClient()

    // The current session, for a refresh on a recovery link: the session is
    // already stored, so no PASSWORD_RECOVERY event is coming.
    const recoveryOnMount = isRecoveryUrlPresent()

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) {
          return
        }

        setState((current) => ({
          ...current,
          session: data.session,
          resolved: true,
          recovery: current.recovery || (data.session !== null && recoveryOnMount),
        }))
      })
      .catch(() => {
        // A failed session read is not an identity question. Leaving `resolved`
        // false would hold the app on a skeleton for ever, so it falls through to
        // anonymous and the sign-in screen shows whatever went wrong.
        if (active) {
          setState((current) => ({ ...current, resolved: true }))
        }
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) {
        return
      }

      setState((current) => ({
        ...current,
        session: next,
        resolved: true,
        recovery: current.recovery || event === 'PASSWORD_RECOVERY',
      }))
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [unconfigured])

  const signUpWithPassword = useCallback<AuthContextValue['signUpWithPassword']>(
    async ({ email, password, displayName }) => {
      const { error } = await getSupabaseClient().auth.signUp({
        email: email.trim(),
        password,
        options: {
          // Read by the trigger that creates the profiles row. Sent here rather
          // than written by the client afterwards, which could not be trusted to
          // put the right row on the right account.
          data: { display_name: displayName.trim() },
          emailRedirectTo: signInRedirectUrl(),
        },
      })

      if (error !== null) {
        throw error
      }
    },
    [],
  )

  const signInWithPassword = useCallback<AuthContextValue['signInWithPassword']>(
    async ({ email, password }) => {
      const { error } = await getSupabaseClient().auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error !== null) {
        throw error
      }
    },
    [],
  )

  const signInWithGoogle = useCallback<AuthContextValue['signInWithGoogle']>(async () => {
    const { error } = await getSupabaseClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: signInRedirectUrl() },
    })

    if (error !== null) {
      throw error
    }

    // No navigation on success. The browser leaves for Google and comes back to
    // /login with the session already in place, so anything this screen did next
    // would be describing a page the user is no longer on.
  }, [])

  const sendPasswordResetEmail = useCallback<AuthContextValue['sendPasswordResetEmail']>(
    async (email) => {
      const { error } = await getSupabaseClient().auth.resetPasswordForEmail(email.trim(), {
        redirectTo: passwordRecoveryRedirectUrl(),
      })

      if (error !== null) {
        throw error
      }
    },
    [],
  )

  const updatePassword = useCallback<AuthContextValue['updatePassword']>(async (password) => {
    const { error } = await getSupabaseClient().auth.updateUser({ password })

    if (error !== null) {
      throw error
    }
  }, [])

  const signOut = useCallback<AuthContextValue['signOut']>(async () => {
    const { error } = await getSupabaseClient().auth.signOut()

    if (error !== null) {
      throw error
    }
  }, [])

  const user = sessionUser(state.session)
  const userId = user?.id ?? null
  const userEmail = user?.email ?? null

  const status: AuthStatus = unconfigured
    ? 'unconfigured'
    : !state.resolved
      ? 'loading'
      : userId === null
        ? 'anonymous'
        : 'authenticated'

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      userId,
      email: userEmail,
      isRecovery: state.recovery,
      signUpWithPassword,
      signInWithPassword,
      signInWithGoogle,
      sendPasswordResetEmail,
      updatePassword,
      signOut,
    }),
    [
      status,
      userId,
      userEmail,
      state.recovery,
      signUpWithPassword,
      signInWithPassword,
      signInWithGoogle,
      sendPasswordResetEmail,
      updatePassword,
      signOut,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/** Whether the address bar is carrying a recovery token right now. */
function isRecoveryUrlPresent(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  return isRecoveryUrl(`${window.location.hash}${window.location.search}`)
}
