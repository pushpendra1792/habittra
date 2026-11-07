# Habittra progress

Status as of 2026-11-07.

Last commit: `chore: use generated db types` (the generated-schema fix).

## Phase status

| Phase               | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 Setup             | Done   | Vite + React 18 + TypeScript (strict), ESLint/Prettier, Vitest/Playwright, `@/` alias, PWA manifest and service worker, README/AGENTS/`.env.example`. Capacitor belongs to Phase 8 and CI to Phase 10, not Phase 0.                                                                                                                                                                                             |
| 1 Design system     | Done   | UI primitives in `src/components/ui`, theme tokens in `src/styles/globals.css`, the `/design` review page, component tests, and committed review screenshots.                                                                                                                                                                                                                                                   |
| 2 Stats logic       | Done   | `src/lib/stats.ts` (totals, percentages, momentum, success rate, current/longest streaks), `src/lib/dates.ts`, and pure-function tests. The full suite passes 21 files / 441 tests.                                                                                                                                                                                                                             |
| 3 Supabase and auth | Done   | Schema and RLS in `supabase/migrations/0001_init.sql`, typed client, API layer, auth provider/screens, auth E2E, and the setup doc. `src/lib/database.types.ts` is generated from the linked project, converted to UTF-8, and excluded from ESLint and Prettier. The owner ran `supabase/tests/rls.test.sql` in the Supabase SQL Editor and all 29 assertions passed; that result cannot be seen from the repo. |
| 4 Tracker screen    | Done   | Month grid, habit manager, month switcher, query/mutation hooks, cache rules, and upsert check-ins. Progress is visible from 768px, 31 days fit from 1024px, today has a teal ring, E2E is environment-independent, and raw auth errors are logged in development. Verified by the commands below.                                                                                                              |

## Phase 4 fixes

- Progress column: the sticky right column appears at 768px and shows the bar and
  percent on every row. Below 768px the small percent by the habit name is shown
  instead, so there is no width where neither appears.
- Day columns: below 1024px they stay 36px wide and the grid scrolls with the
  left column sticky. From 1024px they share the row with a 24px floor. At
  1024px the content width is about 976px and the row needs 128px + 80px +
  31 × 24px = 952px, so the month fits. This is width arithmetic, not an image
  check.
- Today's cell: `CheckCell` uses `ring-accent-teal/40` on dark and
  `ring-accent-teal/60` on light.
- E2E: `npm run test:e2e` builds with blank Supabase keys and blank optional
  flags through the Playwright web server env, so `.env.local` cannot change the
  result. Screenshot capture moved to `playwright.screenshots.config.ts` and
  `npm run screenshots`; normal E2E never writes PNGs.
- Auth logging: `logAuthError` prints the raw message, status and code in
  development for sign up, sign in and password reset. User-facing copy is
  unchanged, and only those three safe fields are logged.

## Verification (2026-11-07)

| Command                         | Result                                                                                                                                 |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                  | Pass                                                                                                                                   |
| `npm run typecheck`             | Pass                                                                                                                                   |
| `npm test`                      | Pass — 21 files, 441 tests. Two expected `useToast` stack traces are printed by `Toast.test.tsx`; they are stderr noise, not failures. |
| `npm run build`                 | Pass — warning: main bundle is 662.77 kB, over the 500 kB warning limit.                                                               |
| `npm run format:check`          | Pass                                                                                                                                   |
| `npm run test:e2e`              | Pass — 51 tests across 360px, 768px and 1280px in 55.7s.                                                                               |
| `npm run screenshots -- --list` | Lists 3 screenshot tests. Screenshot capture is deliberately not part of `test:e2e`.                                                   |

## Known issues

1. Not built yet: Capacitor/Android (Phase 8) and CI (Phase 10).
2. The main JS chunk is 662.77 kB; the build warns about the 500 kB limit.
3. The tracker screen has no E2E coverage because `/` is behind the auth gate;
   its pure helpers are unit-tested. The responsive width fit is checked by
   arithmetic rather than an automated layout test.
4. The committed design screenshots are from 2026-10-02. `npm run screenshots`
   refreshes them, but it is a separate opt-in run.
5. PWA icons are placeholders generated by
   `scripts/generate-placeholder-icons.mjs`; the README says to replace them and
   delete the script.
6. `npm test` prints two expected `useToast` error stack traces from
   `Toast.test.tsx`.

## Next step

Phase 4 is complete. Phase 5 has not been started; wait for the go-ahead before
starting it.
