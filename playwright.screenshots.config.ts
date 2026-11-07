import { defineConfig, devices } from '@playwright/test'

const PORT = 4174
const baseURL = `http://127.0.0.1:${PORT}`

/** Keep the screenshot build independent of any local `.env.local`. */
const TEST_ENV = {
  VITE_SUPABASE_URL: '',
  VITE_SUPABASE_ANON_KEY: '',
  VITE_APP_URL: '',
  VITE_ENABLE_GOOGLE_AUTH: '',
}

export default defineConfig({
  testDir: './e2e',
  testMatch: /screenshots\.spec\.ts/,
  fullyParallel: true,
  reporter: 'list',
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
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: TEST_ENV,
  },
})
