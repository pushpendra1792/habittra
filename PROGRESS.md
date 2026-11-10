# Habittra progress

Status as of 2026-11-10.

Last code commit: `fix: start retry backoff at one second`.

## Phase status

| Phase                   | Status | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 Setup                 | Done   | Vite + React 18 + TypeScript (strict), ESLint/Prettier, Vitest/Playwright, `@/` alias, PWA manifest and service worker, README/AGENTS/`.env.example`. Capacitor belongs to Phase 8 and CI to Phase 10, not Phase 0.                                                                                                                                                                                                                           |
| 1 Design system         | Done   | UI primitives in `src/components/ui`, theme tokens in `src/styles/globals.css`, the `/design` review page, component tests, and committed review screenshots.                                                                                                                                                                                                                                                                                 |
| 2 Stats logic           | Done   | `src/lib/stats.ts` (totals, percentages, momentum, success rate, current/longest streaks), `src/lib/dates.ts`, and pure-function tests. Phase 6A grows the full suite to 27 files / 512 tests.                                                                                                                                                                                                                                                |
| 3 Supabase and auth     | Done   | Schema and RLS in `supabase/migrations/0001_init.sql`, typed client, API layer, auth provider/screens, auth E2E, and the setup doc. `src/lib/database.types.ts` is generated from the linked project, converted to UTF-8, and excluded from ESLint and Prettier. The owner ran `supabase/tests/rls.test.sql` in the Supabase SQL Editor and all 29 assertions passed; that result cannot be seen from the repo.                               |
| 4 Tracker screen        | Done   | Month grid, habit manager, month switcher, query/mutation hooks, cache rules, and upsert check-ins. Progress is visible from 768px, 31 days fit from 1024px, today has a teal ring, E2E is environment-independent, and raw auth errors are logged in development. Verified by the commands below.                                                                                                                                            |
| 5 Dashboard             | Done   | `useMonthStats` reads the tracker's existing query cache and maps every figure through `@/lib/stats`; pure mapping and chart-window tests; success card, month info, three rings with paced-info note, lazy Recharts glow chart, and the aligned daily-total bar row. Mobile order is success, ring carousel, chart, tracker. Recharts is not in the main chunk.                                                                              |
| 6A Local cache and sync | Done   | `idb` stores habits, months of check-ins and the queue under user-scoped keys; the tracker hydrates from IndexedDB before Supabase answers and writes every later cache change back; sign-out clears all local records. Four queue operation kinds, collapse, idempotent replay, backoff, auth pause, failed list, header indicator and `SYNC.md`. Queue, engine and cache keys are unit-tested; the signed-in offline flow is not automated. |

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

## Phase 6A notes

- `idb` is the only dependency added. The database is `habittra-local`, with a
  `cache` store for habits and one month of check-ins per record, and a `sync`
  store for the pending and failed queue. Every key starts with the user id, so
  two accounts on one browser cannot read each other's records.
- Startup hydrates the TanStack Query cache from IndexedDB before the tracker
  mounts, then invalidates those queries so Supabase refreshes them in the
  background. A failed refresh keeps the cached rows on screen. Every later
  `updated` query event is written back, in order, so an optimistic tap is saved
  even if the page reloads before the request finishes.
- The queue holds `add_checkin`, `remove_checkin`, `create_habit` and
  `update_habit` operations. Each has a client-generated queue id, a timestamp
  and a retry count. Check-in and habit ids stay client-generated, and the API
  writes are an upsert on `(habit_id, date)`, a delete by `(habit_id, date)` and
  an upsert on the habit id, so a replay is the same request rather than a new
  row.
- The queue engine is in `src/lib/sync/engine.ts`; the pure rules are in
  `src/lib/sync/queue.ts`. Replay is in order, one `(habit, date)` keeps only its
  latest check-in operation, a create stays ahead of a check-in that depends on
  it, network failures retry from 1s with a 30s cap, auth failures pause without
  dropping anything, and permanent failures move to the failed list with one
  toast that survives a reload.
- `SyncIndicator` shows `Synced`, `Syncing`, `Offline · n` or `Sync error ·
Retry` in the header. It is status text plus one button; there is no popup.
- Sign-out clears cached habits, cached months and the queue for every account on
  the browser. An unsynced change is therefore lost if you sign out before the
  queue drains; `SYNC.md` says so.
- The service worker is still disabled in development. Reloading offline has to
  be checked against `npm run build && npm run preview`, not `npm run dev`.
- Not browser-tested: the signed-in offline flow. It needs real Supabase auth,
  the service worker and a real network toggle, and faking Supabase is not
  allowed. The queue, engine and user-scoped keys are unit-tested; actual
  IndexedDB reads/writes and real upsert idempotency are not automated because
  that would need `fake-indexeddb` or a Supabase mock.

## Verification (2026-11-10)

| Command                | Result                                                                                                                                                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`         | Pass                                                                                                                                                                                                                                                  |
| `npm run typecheck`    | Pass                                                                                                                                                                                                                                                  |
| `npm test`             | Pass — 27 files, 512 tests. Five engine tests cover replay, offline enqueue, auth pause/retry, permanent-failure announcement and backoff. Two expected `useToast` stack traces are printed by `Toast.test.tsx`; they are stderr noise, not failures. |
| `npm run build`        | Pass — warning: main bundle is 692.68 kB, over the 500 kB warning limit.                                                                                                                                                                              |
| `npm run format:check` | Pass                                                                                                                                                                                                                                                  |
| `npm run test:e2e`     | Pass — 51 tests across 360px, 768px and 1280px in 1.0m.                                                                                                                                                                                               |

The dashboard's own chunks are `DailyCompletionChart` at 3.79 kB and a shared
316.53 kB lazy chunk that holds Recharts and `Tabs`; neither is in the initial
main chunk. The main chunk grew from 675.95 kB to 692.68 kB for `idb`, the sync
engine, cache hydration and the header indicator, +16.73 kB (206.66 kB gzip,
+4.81 kB).

## Known issues

1. Not built yet: Capacitor/Android (Phase 8) and CI (Phase 10).
2. The main JS chunk is 692.68 kB; the build warns about the 500 kB limit.
3. The tracker and dashboard have no signed-in E2E coverage because `/` is
   behind the real Supabase auth gate. Their pure helpers are unit-tested, but
   the responsive layouts are checked by class/width arithmetic rather than a
   signed-in screenshot.
4. The offline flow was not exercised in a browser here. It needs two real
   accounts, real Supabase, the production service worker and a network toggle;
   mocking Supabase is not allowed. `queue.ts`, `engine.ts` and the user-scoped
   cache keys are unit-tested, but IndexedDB itself and the live upsert/delete
   calls are not automated.
5. A queue paused by an auth error does not resume when Supabase refreshes the
   token in the background; the user taps Retry in the header, or signs out and
   back in.
6. The committed design screenshots are from 2026-10-02. `npm run screenshots`
   refreshes them, but it is a separate opt-in run.
7. PWA icons are placeholders generated by
   `scripts/generate-placeholder-icons.mjs`; the README says to replace them and
   delete the script.
8. `npm test` prints two expected `useToast` error stack traces from
   `Toast.test.tsx`.

## Next step

Phase 6A is complete. The next phase has not been started; wait for the go-ahead
before starting it.
