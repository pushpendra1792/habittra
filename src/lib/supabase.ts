/**
 * The Supabase client.
 *
 * One client for the whole app, created lazily and memoised. Nothing here talks
 * to a table: reads and writes go through src/lib/api, which is what keeps the
 * snake_case to camelCase mapping in one place.
 *
 * The client is built on first use rather than at import time on purpose. A
 * missing environment variable should be a message on the screen that needs it,
 * not a blank page for the entire app, and a build made without Supabase keys
 * should still render.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/lib/database.types'

/**
 * Thrown when a `VITE_SUPABASE_*` variable is absent or blank.
 *
 * A named error rather than a bare `Error` so callers can tell "Supabase is not
 * configured" apart from "Supabase rejected this", which are very different
 * problems for the person looking at the screen.
 */
export class SupabaseConfigError extends Error {
  /** The variables that need setting, in the order they should be fixed. */
  readonly missing: readonly string[]

  constructor(missing: readonly string[]) {
    super(
      `Missing ${missing.length === 1 ? 'environment variable' : 'environment variables'}: ` +
        `${missing.join(', ')}. Copy .env.example to .env.local and fill it in. ` +
        'See SETUP_SUPABASE.md for where the values come from.',
    )
    this.name = 'SupabaseConfigError'
    this.missing = missing
  }
}

/**
 * The slice of the environment this module needs, as a parameter rather than a
 * read of the global `import.meta.env`. Keeps the check a pure function, so it
 * can be tested without a bundler or an env file.
 */
export interface SupabaseEnvSource {
  readonly VITE_SUPABASE_URL?: string | undefined
  readonly VITE_SUPABASE_ANON_KEY?: string | undefined
}

export interface SupabaseConfig {
  readonly url: string
  readonly anonKey: string
}

/**
 * Reads the two variables that cannot be defaulted, or throws naming what is
 * missing.
 *
 * Whitespace-only counts as missing, because a stray space in an env file is a
 * realistic mistake and `createClient` would otherwise fail later with an opaque
 * network error rather than a clear one.
 *
 * The anon key is not a secret. It ships in the browser bundle by design and
 * what protects the data is row-level security on every table, so there is
 * nothing to guard here beyond making sure the variable is present.
 */
export function readSupabaseEnv(env: SupabaseEnvSource): SupabaseConfig {
  const url = env.VITE_SUPABASE_URL?.trim() ?? ''
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''

  const missing: string[] = []

  if (url === '') {
    missing.push('VITE_SUPABASE_URL')
  }

  if (anonKey === '') {
    missing.push('VITE_SUPABASE_ANON_KEY')
  }

  if (missing.length > 0) {
    throw new SupabaseConfigError(missing)
  }

  return { url, anonKey }
}

/** Reads the live environment. Throws `SupabaseConfigError` if it is not set up. */
export function getSupabaseConfig(): SupabaseConfig {
  return readSupabaseEnv(import.meta.env)
}

/**
 * Builds a client against an explicit config. Useful for tests and for anyone
 * who wants to point at a second project without touching the environment.
 */
export function createSupabaseClient(config: SupabaseConfig): SupabaseClient<Database> {
  return createClient<Database>(config.url, config.anonKey, {
    auth: {
      // Keeps the session in localStorage, so a reload does not sign the user
      // out. Required for the app to be usable at all on a phone.
      persistSession: true,
      autoRefreshToken: true,
      // Reads the token Supabase puts in the URL fragment or query string when
      // it sends someone back from Google or from a password reset email. The
      // app has no other way to receive that response.
      detectSessionInUrl: true,
    },
  })
}

let client: SupabaseClient<Database> | null = null

/**
 * The app-wide client, built on first use and reused after that.
 *
 * Throws `SupabaseConfigError` if Supabase is not configured, and surfaces
 * whatever the network throws if the project cannot be reached. Neither happens
 * at import time.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  client ??= createSupabaseClient(getSupabaseConfig())

  return client
}
