-- Habittra: initial schema.
--
-- Apply once, on an empty project. See SETUP_SUPABASE.md.
--
-- Three tables, one per concern:
--   profiles  one row per auth user, holds preferences
--   habits    what the user is trying to do
--   checkins  one row per habit per calendar day
--
-- Two rules hold throughout.
--
-- `user_id` is denormalised onto habits and checkins on purpose. It lets every
-- row-level security policy be a single comparison against `auth.uid()` instead
-- of a join back to auth.users, and it lets the realtime payloads carry the
-- owner so a subscriber can discard another device's events without a refetch.
-- The checkins policies still confirm the habit belongs to the same user, so a
-- denormalised owner is never the only thing standing between two accounts.
--
-- `date` on checkins is a `date`, never a timestamp. A check-in belongs to the
-- calendar day the user lived. Storing a timestamptz would reintroduce exactly
-- the UTC shift the date rules in AGENTS.md forbid, and would make "which day
-- was this" a function of the server's timezone.


-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  -- 'system' defers to prefers-color-scheme. Kept as text rather than an enum
  -- so adding a theme is a constraint change, not a type migration.
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  -- 'HH:MM' in the user's own timezone, or null for no reminder. Deliberately
  -- text: the app formats it, and no query needs to order by it. No timezone is
  -- stored on the server, ever. See the date rules in AGENTS.md.
  reminder_time text,
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user, created by a trigger on signup. Never written before signup.';


-- ---------------------------------------------------------------------------
-- habits
-- ---------------------------------------------------------------------------

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Trimmed before the length is measured, so a name of spaces is rejected
  -- rather than stored as a habit with nothing to show.
  name text not null check (char_length(btrim(name)) between 1 and 40),
  -- A target, not a limit. Checking in more than the goal in a month is allowed
  -- and is shown as progress past 100 on that habit alone.
  monthly_goal int not null check (monthly_goal between 1 and 31),
  -- Mirrors the five accents in src/lib/accents.ts. A colour outside this set is
  -- a palette change, which is a constraint change here.
  color text not null check (color in ('teal', 'blue', 'purple', 'yellow', 'coral')),
  sort_order int not null default 0,
  -- Archived habits keep their history and stop appearing in the tracker, in
  -- totals and in every percentage. Unarchiving brings them back unchanged.
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.habits is
  'What the user is trying to do. One row per habit, owned by exactly one user.';

-- Serves the only query the app makes: this user's habits, in list order.
create index habits_user_id_sort_order_idx on public.habits (user_id, sort_order);


-- ---------------------------------------------------------------------------
-- checkins
-- ---------------------------------------------------------------------------

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits (id) on delete cascade,
  -- Denormalised from the habit. See the note at the top of this file.
  user_id uuid not null references auth.users (id) on delete cascade,
  -- The calendar day, in the user's own timezone, as the database's `date`.
  date date not null,
  created_at timestamptz not null default now(),
  -- One check-in per habit per day. The database is the only place that can
  -- enforce this across two devices checking in at the same moment.
  constraint checkins_habit_id_date_key unique (habit_id, date)
);

comment on table public.checkins is
  'One row per habit per calendar day. Deleting a habit deletes its check-ins.';

-- Serves the month view and the totals. The unique constraint already indexes
-- habit_id, so a check-in for one habit needs no second index.
create index checkins_user_id_date_idx on public.checkins (user_id, date);


-- ---------------------------------------------------------------------------
-- triggers
-- ---------------------------------------------------------------------------

-- Creates the profile row on signup.
--
-- security definer because the trigger runs as the auth server, not as the new
-- user, and the insert has to happen before anyone can select the row. search_path
-- is pinned empty and every name is qualified, so the function cannot be
-- pointed at another schema by whoever holds CREATE on the database.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(split_part(new.email, '@', 1), '')
    )
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Stamps habits.updated_at on every write. Set in the database rather than by
-- the client so a write from any device, a script or a future edge function
-- still leaves the column honest.
create or replace function public.set_habits_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();

  return new;
end;
$$;

create trigger habits_set_updated_at
  before update on public.habits
  for each row
  execute function public.set_habits_updated_at();

-- Stamps user_id from the session on insert into habits and checkins.
--
-- This is an addition beyond the two triggers the schema strictly needs, and it
-- removes a whole category of bug. The client does not send user_id at all: the
-- column is NOT NULL because the RLS policies compare against it, and a BEFORE
-- trigger runs before that constraint is checked, so auth.uid() fills it in. The
-- effect is that no client, authenticated or not, can attribute a habit or a
-- check-in to somebody else's account, and neither insert needs a session fetch
-- on the way in to find out who is signing.
--
-- The consequence for the policies below: on habits, `user_id` is not a column a
-- caller can influence, so `using (user_id = auth.uid())` is the whole check. On
-- checkins, `habit_id` is not, which is why those policies also confirm the habit
-- belongs to the same account.
create or replace function public.set_row_user_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.user_id := auth.uid();

  return new;
end;
$$;

create trigger habits_set_user_id
  before insert on public.habits
  for each row
  execute function public.set_row_user_id();

create trigger checkins_set_user_id
  before insert on public.checkins
  for each row
  execute function public.set_row_user_id();


-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------
--
-- Every table is closed by default. Enabling RLS with no policies means anon and
-- authenticated get nothing; the policies below then open up exactly one
-- account's rows each.
--
-- `auth.uid()` is wrapped in `(select ...)` on purpose. Unwrapped it is a stable
-- function evaluated per row; wrapped, Postgres evaluates it once as an InitPlan
-- and reuses it. On a query that touches a user's whole month of check-ins that
-- is the difference between one call and several thousand.
--
-- No policy is granted to `anon`. An unauthenticated request has auth.uid() of
-- null and matches nothing anyway, but leaving the role out entirely means the
-- denial does not depend on that.

alter table public.profiles enable row level security;
alter table public.habits enable row level security;
alter table public.checkins enable row level security;

-- profiles: the id *is* the auth user id, so there is no user_id to compare.

create policy profiles_select_own
  on public.profiles
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy profiles_insert_own
  on public.profiles
  for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_own
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy profiles_delete_own
  on public.profiles
  for delete
  to authenticated
  using (id = (select auth.uid()));

-- habits: user_id is denormalised, so every policy is one comparison.

create policy habits_select_own
  on public.habits
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy habits_insert_own
  on public.habits
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy habits_update_own
  on public.habits
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy habits_delete_own
  on public.habits
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

-- checkins: user_id scopes the row, and the habit has to belong to the same
-- account on the way in. The exists() is not redundant with the user_id test:
-- user_id is set by a trigger, so it is a column a caller cannot influence,
-- whereas habit_id is not. The pair is what makes the write safe.
--
-- The subquery is itself subject to habits_select_own, so it can only ever find
-- the caller's own habits. Belt and braces, and it resolves through the primary
-- key on habits.id.

create policy checkins_select_own
  on public.checkins
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy checkins_insert_own
  on public.checkins
  for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.habits
      where habits.id = checkins.habit_id
        and habits.user_id = (select auth.uid())
    )
  );

create policy checkins_update_own
  on public.checkins
  for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.habits
      where habits.id = checkins.habit_id
        and habits.user_id = (select auth.uid())
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.habits
      where habits.id = checkins.habit_id
        and habits.user_id = (select auth.uid())
    )
  );

create policy checkins_delete_own
  on public.checkins
  for delete
  to authenticated
  using (user_id = (select auth.uid()));


-- ---------------------------------------------------------------------------
-- realtime
-- ---------------------------------------------------------------------------
--
-- Habits and checkins only. Profiles is left out on purpose: it is one row that
-- only ever changes in settings, and a broadcast of it would be noise.
--
-- Guarded, because Supabase already includes these tables in some project
-- templates. Running this twice should be a no-op rather than
-- "table is already member of publication".
--
-- Nothing subscribes yet. The client helpers in src/lib/api do, so the wiring is
-- live the moment a caller asks for changes.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'habits'
  ) then
    alter publication supabase_realtime add table public.habits;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'checkins'
  ) then
    alter publication supabase_realtime add table public.checkins;
  end if;
end;
$$;