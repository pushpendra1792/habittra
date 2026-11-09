# Habittra progress

Status as of 2026-11-09.

Last code commit: `feat: compose dashboard around tracker`.

## Phase status

| Phase               | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 Setup             | Done   | Vite + React 18 + TypeScript (strict), ESLint/Prettier, Vitest/Playwright, `@/` alias, PWA manifest and service worker, README/AGENTS/`.env.example`. Capacitor belongs to Phase 8 and CI to Phase 10, not Phase 0.                                                                                                                                                                                             |
| 1 Design system     | Done   | UI primitives in `src/components/ui`, theme tokens in `src/styles/globals.css`, the `/design` review page, component tests, and committed review screenshots.                                                                                                                                                                                                                                                   |
| 2 Stats logic       | Done   | `src/lib/stats.ts` (totals, percentages, momentum, success rate, current/longest streaks), `src/lib/dates.ts`, and pure-function tests. Phase 5 grows the full suite to 22 files / 456 tests.                                                                                                                                                                                                                   |
| 3 Supabase and auth | Done   | Schema and RLS in `supabase/migrations/0001_init.sql`, typed client, API layer, auth provider/screens, auth E2E, and the setup doc. `src/lib/database.types.ts` is generated from the linked project, converted to UTF-8, and excluded from ESLint and Prettier. The owner ran `supabase/tests/rls.test.sql` in the Supabase SQL Editor and all 29 assertions passed; that result cannot be seen from the repo. |
| 4 Tracker screen    | Done   | Month grid, habit manager, month switcher, query/mutation hooks, cache rules, and upsert check-ins. Progress is visible from 768px, 31 days fit from 1024px, today has a teal ring, E2E is environment-independent, and raw auth errors are logged in development. Verified by the commands below.                                                                                                              |
| 5 Dashboard         | Done   | `useMonthStats` reads the tracker's existing query cache and maps every figure through `@/lib/stats`; pure mapping and chart-window tests; success card, month info, three rings with paced-info note, lazy Recharts glow chart, and the aligned daily-total bar row. Mobile order is success, ring carousel, chart, tracker. Recharts is not in the main chunk.                                                |

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

## Phase 5 notes

- `useMonthStats(monthKey)` calls the same `useHabits()` and `useCheckins()` hooks
  as the grid, so there is no dashboard-only request. Because the optimistic
  toggle writes to the same TanStack Query cache, a tap changes the grid, the
  daily bar, the chart, the success card and all three rings in one render.
- The pure mapping is in `src/features/dashboard/monthStats.ts`; the chart window,
  maximum-point and bar-height helpers are in `chartModel.ts` and unit-tested.
  No Phase 2 formula was changed or copied.
- Desktop is a three-column summary above the tracker (month info, chart,
  success rate), with three rings below it. Under 768px the order is success
  card, swipeable ring carousel, chart, then tracker. The month info block is
  desktop-only; the month switcher remains above it on mobile.
- The chart is a `React.lazy` chunk. It uses the GlowLine visual language
  (monotone teal line, SVG drop-shadow glow, grid, value labels, ringed maximum)
  and passes future days as `null` so the line stops at today.
- First-load motion is 700ms for the rings, line and number count-up. Later
  toggles use 200ms value transitions, and `prefers-reduced-motion` removes both
  the CSS and JS animation paths.
- Bundle: main went from 662.77 kB (197.88 kB gzip) to 675.95 kB (201.85 kB
  gzip), +13.18 kB. The chart is a separate 3.79 kB chunk; Recharts moved into a
  shared lazy chunk of 316.53 kB that loads with the chart or the design page,
  not with the initial dashboard. The 500 kB main-chunk warning is unchanged.
- The signed-in dashboard has no E2E coverage. `/` is behind the real Supabase
  auth gate, and adding a dashboard E2E would require mocking Supabase, which is
  not allowed here. The mapping edge cases, empty month and future month are
  unit-tested; the 360/768/1280 layouts were reviewed by reading the responsive
  classes and width arithmetic rather than by a signed-in screenshot.

## Verification (2026-11-09)

| Command                | Result                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`         | Pass                                                                                                                                   |
| `npm run typecheck`    | Pass                                                                                                                                   |
| `npm test`             | Pass — 22 files, 456 tests. Two expected `useToast` stack traces are printed by `Toast.test.tsx`; they are stderr noise, not failures. |
| `npm run build`        | Pass — warning: main bundle is 675.95 kB, over the 500 kB warning limit.                                                               |
| `npm run format:check` | Pass                                                                                                                                   |
| `npm run test:e2e`     | Pass — 51 tests across 360px, 768px and 1280px in 1.2m.                                                                                |

The dashboard's own chunks are `DailyCompletionChart` at 3.79 kB and a shared
316.53 kB lazy chunk that holds Recharts and `Tabs`; neither is in the initial
main chunk. The main chunk grew from 662.77 kB to 675.95 kB for the static
dashboard components and the stats hook.

## Known issues

1. Not built yet: Capacitor/Android (Phase 8) and CI (Phase 10).
2. The main JS chunk is 675.95 kB; the build warns about the 500 kB limit.
3. The tracker and dashboard have no signed-in E2E coverage because `/` is
   behind the real Supabase auth gate. Their pure helpers are unit-tested, but
   the responsive layouts are checked by class/width arithmetic rather than a
   signed-in screenshot.
4. The committed design screenshots are from 2026-10-02. `npm run screenshots`
   refreshes them, but it is a separate opt-in run.
5. PWA icons are placeholders generated by
   `scripts/generate-placeholder-icons.mjs`; the README says to replace them and
   delete the script.
6. `npm test` prints two expected `useToast` error stack traces from
   `Toast.test.tsx`.

## Next step

Phase 5 is complete. Phase 6 has not been started; wait for the go-ahead before
starting it.
