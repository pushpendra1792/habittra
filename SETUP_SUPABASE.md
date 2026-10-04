# Setting up Supabase

Everything here is manual. The migration is written; applying it and creating the
Google client are things a person does once, in a browser, with their own
account. Follow it in order: step 4 will fail confusingly without step 3, and the
auth screens will report the wrong thing without step 2.

Nothing in this file is a secret except the values you paste into `.env.local`,
which is gitignored. Do not commit them, and do not paste the `service_role` key
into any `VITE_` variable.

---

## 1. Create the project

1. Go to <https://supabase.com/dashboard> and sign in.
2. **New project**.
3. Name it `habittra`. Generate a strong database password and keep it: it is
   shown once and never again.
4. Pick a region near your users. It cannot be changed later.
5. Set the **Database password** and wait for provisioning to finish.

The free plan is enough. Nothing in this project needs the Pro tier.

## 2. Copy the two keys

**Project Settings → API Keys**.

| What you need   | Where it is                                                                                    | What it looks like                  |
| --------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------- |
| Project URL     | **Project Settings → Data API → Project URL**                                                  | `https://abcdefghijklm.supabase.co` |
| Publishable key | **Project Settings → API Keys → Publishable key** (older projects: **API Keys → anon public**) | `eyJhbGci...`                       |

The publishable (anon) key is **not a secret**. It ships in the browser bundle by
design. What protects the data is row-level security, which the migration turns
on for every table. Never put the `service_role` key in a `VITE_` variable: it
bypasses RLS, so anything holding it can read and write every row in the
database.

The URL is in the dashboard in two places and they can disagree: **Data API →
Project URL** is the current one, and the older **API → URL** still exists on some
projects. Use the Data API one.

## 3. Apply the migration

1. **SQL Editor → New query**.
2. Open `supabase/migrations/0001_init.sql` and paste the whole file in.
3. **Run**.

Expect `Success. No rows returned`. Then check it landed:

- **Table Editor** shows `checkins`, `habits`, `profiles`.
- Each table shows a shield icon, meaning RLS is on. Click one and the RLS
  policies tab lists four or five rows. If the shield is missing, the `alter
table ... enable row level security` statements did not run.

Run it once. It is a first migration for an empty project, and `create table`
fails if the table already exists.

### Applying it with the CLI instead

Optional. The Supabase CLI is not a dependency of this repo; use it through `npx`
so nothing is added to `package.json`.

```bash
npx supabase init                 # once, writes supabase/config.toml
npx supabase login
npx supabase link --project-ref <project-ref>   # Project Settings -> General -> Reference ID
npx supabase db push
```

Then regenerate the database types and commit the diff:

```bash
npx supabase gen types typescript --linked --schema public > src/lib/database.types.ts
```

`src/lib/database.types.ts` was hand-written to match the migration. The command
above replaces it with generator output and is the check that the two agree. Pin
the version for a reproducible diff: `npx supabase@latest gen types ...`.

For a local stack, `npx supabase start` and replace `--linked` with `--local`.

## 4. Turn on email and password

**Authentication → Sign In / Providers → Email**.

- **Enable Email Provider** on.
- **Confirm email**: on for anything real. The signup screen already says "Check
  your email", and the `handle_new_user` trigger fires on the auth row, so the
  account exists either way. Turning confirmations on means an address has to be
  proven before it can sign in.
- **Secure email change** and **Secure password change**: on.
- **Password strength**: at least 6 characters, or stronger. The app's minimum
  matches the 6-character default; if you raise it, raise
  `MIN_PASSWORD_LENGTH` in `src/features/auth/validation.ts` to match.
- **Email template**: the default is fine. The signup screen deliberately says
  "If that address needs confirming, the link is on its way" because it cannot
  know whether your project asks for confirmation, and the copy has to be true
  either way.

Leave phone auth off. It costs money and nothing in the app uses it.

## 5. Redirect URLs

**Authentication → URL Configuration → Redirect URLs**. Add all of these:

| URL                                        | When it is used                      |
| ------------------------------------------ | ------------------------------------ |
| `http://localhost:5173/login`              | Local dev, sign-in and OAuth return  |
| `http://localhost:5173/reset-password`     | Local dev, password recovery link    |
| `https://<your-domain>/login`              | Production, sign-in and OAuth return |
| `https://<your-domain>/reset-password`     | Production, password recovery link   |
| `com.pushpendra.habittra://login-callback` | The Android app                      |

Also fill in **Site URL** with `http://localhost:5173` for now, and change it to
`https://<your-domain>` when you deploy. Site URL is only the fallback for a
redirect the app did not ask for, so it matters less than the list above, but
leaving it pointed at localhost makes emailed links go to the wrong place.

Replace `<your-domain>` with the real one. There is no placeholder that works.

### The Android URL

`com.pushpendra.habittra://login-callback` is a custom scheme, and it works
because the Android app registers that scheme as an intent filter. It cannot work
until the Android project declares it, so expect this row to be inert for now and
keep it in the list for when the app exists.

A custom scheme can be claimed by any app on the device, so treat the token in it
as unverified input: the app must exchange it server-side and check the audience.
That work belongs to the Android phase, not to this one.

## 6. Point the app at the project

```bash
cp .env.example .env.local
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from step 2. Leave
`VITE_ENABLE_GOOGLE_AUTH=false` for now, so the Google button stays hidden and
email auth is the whole story.

```bash
npm run dev
```

Open <http://localhost:5173>. You should be redirected to `/login`. Sign in with a
made-up address and you should get "That email and password do not match."
rather than a Supabase error, which means the client, the keys and the error
mapping are all working.

If the app says **"Supabase is not set up. See SETUP_SUPABASE.md."** then one of
the two variables is missing or blank. That is the same check that runs when the
app builds, so it is safe to ignore: a build with no keys still renders.

## 7. The Google client

Optional. Skip this until email auth works, because the button is hidden unless
`VITE_ENABLE_GOOGLE_AUTH=true`.

1. Go to <https://console.cloud.google.com/> → pick or create a project.
2. **APIs & Services → OAuth consent screen**. Choose External. Fill in the app
   name, your support email and a developer contact email. Add the scopes you
   need: `.../auth/userinfo.email` and `.../auth/userinfo.profile`. Publish. While
   the app is in testing, add your own Google account under **Test users**, or
   sign-in will fail with a 403.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   Application type: **Web application**.
4. Under **Authorized redirect URIs**, add exactly:
   - `https://<project-ref>.supabase.co/auth/v1/callback`
   - `http://localhost:5173/login`
   - `https://<your-domain>/login`
5. Press Create and copy the **Client ID** and **Client Secret**.
6. In the Supabase dashboard, **Authentication → Sign In / Providers → Google**:
   - **Enable Google** on.
   - Paste the Client ID and the Client Secret.
7. In `.env.local`, set `VITE_ENABLE_GOOGLE_AUTH=true`.
8. Restart `npm run dev`. The Google button appears on `/login` and `/signup`.

Only the **Client ID** goes anywhere in this repo, and only as a public OAuth
credential. The **Client Secret** goes into the Supabase dashboard and nowhere
else: it is not a `VITE_` variable, it does not enter the bundle, and there is no
place in `.env.local` for it.

The redirect URI `https://<project-ref>.supabase.co/auth/v1/callback` is the one
that matters. Google sends the browser to Supabase, Supabase exchanges the code,
and only then sends the user to your app. The `http://localhost:5173/login` entry
is not used by that flow; it is there for Supabase's own internal consistency and
can be left out if Google complains.

### Why the app's own URL is in the list too

Supabase validates the final hop against its Redirect URLs list, so
`http://localhost:5173/login` has to be in the dashboard even though Google never
sees it. Miss that and you get `redirect_to not allowed`, which reads like a Google
problem and is not.

## 8. Prove the rows are private

Row-level security is the only thing between two accounts and each other's
habits. `supabase/tests/rls.test.sql` checks that with pgTAP.

It has **not been run against a project** as part of building this. Run it
yourself before you trust it.

### Enable pgTAP first

**Database → Extensions**, find **pgTAP**, enable it. Nothing else in the setup
depends on it, and without it the test cannot run at all: every assertion fails
with `function plan(integer) does not exist`.

### Run it in the SQL Editor

1. **SQL Editor → New query**.
2. Open `supabase/tests/rls.test.sql` and paste the whole file in, header
   comments and all. Do not run it in parts.
3. **Run**.

It takes a second or two, and the result is a table: one row per assertion, with
a `result` column of `ok` or `not ok`, and a last row that is the count.

| num | result | description                                     | detail |
| --- | ------ | ----------------------------------------------- | ------ |
| 1   | ok     | the signup trigger created a profile row        |        |
| 2   | ok     | a new profile defaults to the system theme      |        |
| 3   | ok     | A sees exactly A's two habits                   |        |
| …   |        |                                                 |        |
| 28  | ok     | a request with no session sees no profiles      |        |
| 29  | ok     | a request with no session cannot change a habit |        |
|     | ok     | 29 of 29 passed                                 |        |

The bottom row is what you want: `29 of 29 passed`, marked `ok`. The `num` is
blank on it because it is not an assertion.

Anything else means a policy is wrong:

- **`not ok` on a row** — the `detail` column says what disagreed. For example
  `have 3, want 2` means a user can see a row that is not theirs.
- **`not ok` on the summary row** — it reads `28 of 29 passed - 1 FAILED`, and the
  `not ok` rows above it are the failures.
- **An error instead of a table** — read the message. `function plan(integer)
does not exist` means pgTAP is not enabled. Anything else names the statement
  that failed.

### Run it with the CLI instead

Optional. The Supabase CLI is not a dependency of this repo; use it through
`npx`, and note that this needs a local stack rather than the hosted project.

```bash
npx supabase start                                   # local stack
npx supabase test db                                 # all files in supabase/tests
npx supabase test db supabase/tests/rls.test.sql     # or just this one
```

### Running it twice, and what it leaves behind

It is safe to run against a project that has real data. Everything it creates is
inside a transaction that ends in `rollback`, so no test user, habit or
check-in survives. The `tests` schema it creates its helpers in disappears with
the same rollback, and the file drops any leftover copy of it before it starts,
so a second run needs no cleanup in between.

Until you have run it, treat the policies as unverified.

## 9. Turn on realtime, if you are curious

Already done in the migration: `habits` and `checkins` are added to the
`supabase_realtime` publication. Nothing subscribes yet, so the addition costs
nothing. The client helpers are `subscribeToHabits` in
`src/lib/api/habitsApi.ts` and `subscribeToCheckins` in
`src/lib/api/checkinsApi.ts`; they are called from a screen when there is one to
wire them into.

Verify with **Table Editor → Realtime Inspector**: sign in on two browsers with
two different accounts and check in on one. Nothing appears in the other, and that
is row-level security working on the realtime path as well as the query path.
