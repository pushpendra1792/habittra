# AGENTS.md

Rules for any agent or contributor working in Habittra. These are not
suggestions. They apply to every change.

Read this file before you touch anything.

The app is spelled `Habittra` — one `b`, two `t`, capital `H`, lowercase after.
Match that exactly in `package.json`, the web manifest, `index.html`, the README
and anywhere else the name appears. Do not introduce `Habitra`, `Habbitra`,
`Habittra.app` in prose, or any other variant.

## Secrets

- Never commit secrets or keystores. Not `.env`, not a service-role key, not a
  `.jks`, `.keystore`, `.p12` or `.pfx`, not an adb debug key.
- Real values go in `.env.local`, which is gitignored. `.env.example` documents
  the variable names and nothing else.
- Only `VITE_`-prefixed variables reach the browser bundle. If a value must stay
  secret, it does not go in a `VITE_` variable.
- The Supabase anon key is not a secret and is expected in the frontend. What
  protects the data is row-level security. Never weaken RLS to make something
  work.
- If you ever commit a secret, say so plainly in your report. Do not quietly
  amend it away and move on.

## Commits

- Small commits, one task each.
- Conventional Commits: `feat:`, `fix:`, `chore:`, plus `docs:`, `refactor:`,
  `test:`, `build:`, `ci:` when they apply.
- Imperative mood, present tense. `feat: add habit streak calculation`.
- Commit after each task, not once at the end of a batch.
- Do not reword or squash history unless asked. Do not force-push.
- Never commit generated build output, `dist/`, `android/`, or coverage reports.

## Dependencies

- No new dependencies without telling me why.
- Explain what the package does, why the standard toolchain will not do, and
  what the maintenance and bundle-size cost is. Then wait for a decision.
- Do not quietly reach for a library to avoid twenty lines of code. Twenty lines
  of code is usually the right answer.
- Do not swap anything in the fixed stack. If the stack is genuinely blocking
  the work, say so and stop, rather than substituting on your own.

## Honesty

- No placeholder lorem ipsum or fake features. If something is not built, do not
  show it.
- No dead buttons, no "coming soon" panels, no charts fed invented data, no
  hardcoded fake rows in a list.
- Do not stub a function to return a plausible value. Either implement it or
  leave it out.
- If a test is skipped, commented out, or weakened to make a run go green, call
  it out explicitly in your report.
- If you could not verify something, say so. Do not report a command as passing
  when you did not run it.
- If you hit a blocker, stop and report it. Do not leave the repo in a
  half-migrated state and describe it as done.

## Tests

- Every pure function gets a unit test. A pure function is one whose output
  depends only on its arguments: date maths, streak logic, formatters, parsers,
  reducers, selectors, validators.
- Test the edge cases, not just the happy path: empty input, one element,
  boundaries, negative numbers, invalid dates, duplicates.
- Name tests after the behaviour, not the implementation.
- Do not test framework wiring. Test the code.
- E2E tests run at 360px, 768px and 1280px. Those three projects are already
  configured in `playwright.config.ts`.
- `npm run lint`, `npm run typecheck` and `npm test` must all pass before you
  report a task as done.

## Design

- Mobile-first. The primary target is a phone in one hand. Build the 360px
  layout first, then let wider screens be an enhancement.
- Test layouts at 360px, 768px and 1280px widths before calling a layout done.
- Respect `prefers-reduced-motion`. Global CSS already neutralises animations
  and transitions under `reduce`; do not re-enable them per component, and keep
  any Framer Motion work behind a reduced-motion check.
- Keep the UI minimal. If in doubt, remove, don't add.
- Respect the theme tokens in `src/styles/globals.css`. Do not introduce new
  hardcoded colours or spacing values that already exist as tokens.
- Every interactive element needs a visible focus state and an accessible name.
- Do not add a component library, a state manager, or a design system to solve a
  problem that plain React and Tailwind already solve.

## Dates and time

- Store check-in dates as plain `YYYY-MM-DD` strings in the user's local
  calendar.
- Never use UTC conversion to decide which day a check-in belongs to.
- Do not round-trip a check-in through `Date` and `toISOString()`. `toISOString()`
  converts to UTC and will shift the day for anyone west of Greenwich in the
  evening, and east of it in the morning.
- Parse a `YYYY-MM-DD` string by splitting on `-` and constructing a local date,
  or use a date library. Do not rely on `new Date('2026-01-01')` parsing as UTC.
- The same rule applies to streaks, "today", week boundaries and any date
  filtering. A check-in belongs to the calendar day the user experienced.
- Timezone comes from the user's device. Do not store or infer a timezone on the
  server to work around this.

## Before you finish

Run these and report the real results:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Then report what you changed, what you verified, and what you did not.
