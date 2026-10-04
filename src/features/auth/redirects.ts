/**
 * Where Supabase sends someone back to.
 *
 * Two different places, because two different things happen on arrival:
 *
 *   /login           after Google, and after confirming an email by clicking the
 *                    link in it. There is nothing left to do but sign in.
 *   /reset-password  after a recovery email. The link carries a token, the client
 *                    picks it up, and the screen asks for a new password.
 *
 * Supabase only takes one redirect URL per call, so they are set per call rather
 * than in one place.
 *
 * Add every URL here to the Supabase project's Redirect URLs, and to the same
 * list on the Google OAuth client. SETUP_SUPABASE.md has the exact list.
 */

/** The public origin of the app. */
export function appOrigin(): string {
  const configured = import.meta.env.VITE_APP_URL?.trim()

  // window.location.origin is right in local dev and in a deployed web build,
  // which is why it is the fallback rather than a hardcoded localhost.
  return configured !== undefined && configured !== ''
    ? configured.replace(/\/+$/, '')
    : window.location.origin
}

/** A path within the app, resolved against the origin. */
export function absoluteUrl(path: string): string {
  return `${appOrigin()}${path}`
}

/** Where a sign-in, an OAuth return or an email confirmation lands. */
export function signInRedirectUrl(): string {
  return absoluteUrl('/login')
}

/** Where a recovery email lands. */
export function passwordRecoveryRedirectUrl(): string {
  return absoluteUrl('/reset-password')
}

/**
 * True when the current URL carries a recovery token.
 *
 * Supabase sends it as `type=recovery` in the fragment, and the fragment is what
 * `detectSessionInUrl` reads the token from. Checked as text because the exact
 * shape of the rest of the URL is Supabase's business, and the one thing this
 * screen needs to know is whether a token came with it.
 *
 * Checked on mount as well as on the auth event, because a refresh on
 * /reset-password finds the session already in storage and no second
 * PASSWORD_RECOVERY event is emitted. Without this the screen would offer to send
 * another email to someone who is one field away from choosing a new password.
 */
export function isRecoveryUrl(url: string): boolean {
  return url.includes('type=recovery')
}

/**
 * Where to send someone once they are signed in.
 *
 * `ProtectedRoute` records the page they were trying to reach, so signing in takes
 * them there rather than dumping them on the home screen. Anything that is not a
 * path on this origin falls back: the value arrives from history state and is not
 * worth trusting enough to navigate to blindly.
 */
export function redirectTarget(state: unknown, fallback = '/'): string {
  if (typeof state !== 'object' || state === null) {
    return fallback
  }

  const from = (state as { readonly from?: unknown }).from

  // `//` is rejected as well as a missing slash. It is a protocol-relative URL, not
  // a path, and there is no reason for one to arrive here at all.
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) {
    return fallback
  }

  return from
}
