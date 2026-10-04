/// <reference types="vite/client" />

/**
 * The environment variables this app reads, declared so a missing one is a
 * compile error at the point it is used rather than an `any` at the point it is
 * fetched. Values are still validated at runtime: Vite substitutes the string
 * `undefined` for an unset variable and TypeScript cannot see that happen.
 *
 * See `.env.example` and SETUP_SUPABASE.md.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Public origin of the deployed site. Used to build auth redirect URLs. */
  readonly VITE_APP_URL?: string
  /**
   * Set to `true` to show the Google button. Unset or anything else hides it,
   * so email auth works on a project with no Google OAuth client set up.
   */
  readonly VITE_ENABLE_GOOGLE_AUTH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
