import { defineConfig, devices } from '@playwright/test'

const PORT = 4173
const baseURL = `http://127.0.0.1:${PORT}`

/**
 * The E2E build must not take its configuration from `.env.local`. Blank values
 * make the app exercise the "Supabase is not set up" path. The optional flags
 * are blanked too, so a developer's `.env.local` cannot change the auth screens
 * under test.
 */
const TEST_ENV = {
  VITE_SUPABASE_URL: '',
  VITE_SUPABASE_ANON_KEY: '',
  VITE_APP_URL: '',
  VITE_ENABLE_GOOGLE_AUTH: '',
}

export default defineConfig({
  testDir: './e2e',
  // Screenshot capture is a separate run with its own config.
  testIgnore: /screenshots\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: process.env['CI'] ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'mobile-360',
      use: { ...devices['Pixel 7'], viewport: { width: 360, height: 800 } },
    },
    {
      name: 'tablet-768',
      use: { ...devices['iPad (gen 7)'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'desktop-1280',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    // `vite preview` serves dist/, so build first. Keeps `npm run test:e2e`
    // self-contained instead of depending on a previous manual build.
    // --host is pinned because `vite preview` otherwise binds only to the IPv6
    // `localhost`, which Playwright's IPv4 health check cannot reach.
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: baseURL,
    // Always build. A preview left running from a real `.env.local` must not
    // decide what the suite sees.
    reuseExistingServer: false,
    timeout: 180_000,
    env: TEST_ENV,
  },
})
