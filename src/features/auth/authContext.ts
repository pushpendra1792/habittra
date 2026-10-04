/**
 * The auth context and its types.
 *
 * Separate from the provider component so `useAuth` can be imported without
 * dragging the component in, and so the type of the auth state is written down
 * once. Mirrors the split between src/lib/toast.ts and Toast.tsx.
 */
import type { Session, User } from '@supabase/supabase-js'
import { createContext } from 'react'

/**
 * Where the app is with respect to a signed-in user.
 *
 * Four states rather than a boolean, because a signed-in user and a Supabase
 * that was never configured are not the same thing and must not both render as
 * "logged out": one is a redirect to /login, the other is an error on screen.
 *
 *   loading      still asking Supabase who the user is. The gate shows a
 *                skeleton of the same shape, so nothing jumps when it resolves.
 *   authenticated a session exists
 *   anonymous    Supabase answered and there is no session
 *   unconfigured no VITE_SUPABASE_* variables. No request is attempted.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'unconfigured'

export interface SignUpInput {
  email: string
  password: string
  /** Optional. Copied to profiles.display_name by the signup trigger. */
  displayName: string
}

export interface SignInInput {
  email: string
  password: string
}

export interface AuthContextValue {
  status: AuthStatus
  /** The signed-in user's id, or null when there is no session. */
  userId: string | null
  email: string | null
  /**
   * True when the session in hand came from a password recovery link rather than
   * from a normal sign-in, which is what lets /reset-password know to ask for a
   * new password instead of sending another email.
   */
  isRecovery: boolean

  signUpWithPassword: (input: SignUpInput) => Promise<void>
  signInWithPassword: (input: SignInInput) => Promise<void>
  signInWithGoogle: () => Promise<void>
  sendPasswordResetEmail: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

/** Narrowing helper for the pieces of the session this app reads. */
export function sessionUser(session: Session | null): User | null {
  return session?.user ?? null
}
