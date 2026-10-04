-- Row-level security: one account must not be able to read, change or fake data
-- for another.
--
-- This is the only check in the repo that proves anything about the database.
-- Everything else is TypeScript running against pure functions, which cannot tell
-- you whether a policy is right.
--
-- ---------------------------------------------------------------------------
-- Before you run this
-- ---------------------------------------------------------------------------
--
-- Enable pgTAP once: in the dashboard, Database, Extensions, then pgTAP and
-- Enable. Nothing here depends on any other project setting, and without that one
-- extension every assertion below fails with `function plan(integer) does not
-- exist`.
--
-- Against the hosted project, paste this whole file into SQL Editor, New query,
-- and press Run. Against a local stack:
--
--   npx supabase start
--   npx supabase test db supabase/tests/rls.test.sql
--
-- ---------------------------------------------------------------------------
-- What a pass looks like
-- ---------------------------------------------------------------------------
--
-- The last query in the file is a report: one row per assertion, numbered, marked
-- `ok` or `not ok`, with the description, and with the actual values on the rows
-- that failed. The last of those rows is the count: `29 of 29 passed`. The SQL
-- Editor shows the result of the final statement and nothing else, which is why
-- the report is last.
--
-- The pgTAP summary from `finish()` is emitted just above it in the same
-- response and says the same thing in TAP form.
--
-- ---------------------------------------------------------------------------
-- How it works
-- ---------------------------------------------------------------------------
--
-- It creates two throwaway auth users, A and B, gives each one a habit, and then
-- switches between them the way Supabase switches for a real request: by setting
-- the role and the JWT claims. Every assertion is one user doing something to a
-- row belonging to the other.
--
-- The fixtures are created the same way, as their own owner, because
-- `set_row_user_id` stamps `auth.uid()` over the `user_id` on insert. A row
-- created by the admin role with no session gets a null owner and the not-null
-- constraint rejects it. See the note in the fixtures section.
--
-- Everything is in a transaction that is rolled back at the end, so it leaves
-- nothing behind: no test users, no habits, no check-ins, and not even the
-- `tests` schema, which is why the next run can be pasted in unchanged.
--
-- ---------------------------------------------------------------------------
-- Assumptions, and what each helper is for
-- ---------------------------------------------------------------------------
--
-- The statements run as the role they are written for, so they are refused by
-- row-level security, not by a missing table privilege. That is why the file
-- assumes Supabase's default grants on schema `public`: `anon` and
-- `authenticated` can select and write the three tables. A project that has
-- revoked those would fail loudly rather than quietly pass.
--
-- A refusal comes in two shapes and the helpers distinguish them:
--
--   * An INSERT whose row fails a `with check` raises `insufficient_privilege`.
--   * An UPDATE or DELETE whose row fails `using` is not an error at all. The
--     row is simply not visible, the statement matches nothing, and it reports
--     zero rows affected. `tests.refused` counts that as a refusal too, because
--     that is what a refusal looks like from the outside.
--
-- Anything else -- a typo, a missing column, a constraint firing on the fixture
-- itself -- propagates out and stops the run rather than being counted as a
-- rejection.
--
-- The five "nothing changed" assertions run with the role reset, because they
-- read B's rows and A cannot see them. Reading B's habit as A returns no row at
-- all, which would prove nothing about whether A's attempt changed it.

begin;

-- pgTAP installs into `extensions` on a hosted project and into `public` on a
-- local stack. Both are searched, so this file runs either way.
set local search_path = public, extensions;

-- First, and before anything is created or dropped, so a missing extension is
-- the only thing that can fail: it reports `function plan(integer) does not
-- exist` and touches nothing. The count has to equal the number of assertions
-- below.
select plan(29);

-- Safe to re-run. A run that was interrupted after the schema was created, or
-- one left behind by an older version of this file, is cleared first. Cascade
-- takes the old helpers with it, so there is nothing else to drop by hand.
drop schema if exists tests cascade;

create schema tests;

-- ---------------------------------------------------------------------------
-- reporting
-- ---------------------------------------------------------------------------
--
-- Every assertion lands here, in order, whether it passed or failed. It is a
-- temp table, so it exists only inside this transaction, and it is in `pg_temp`
-- explicitly because the assertions below run as `authenticated` and `anon`
-- rather than as the role that created it.
create temporary table test_results (
  num         bigint generated always as identity,
  ok          boolean not null,
  description text    not null,
  detail      text
);

-- The one function that writes to the results table, and the only one that is
-- security definer: the assertions run as `authenticated` or `anon`, and neither
-- owns a temp table it did not create. Its body is one insert and one call to
-- pgTAP's `ok()`, so there is nothing in it for a caller to aim at.
--
-- A failed comparison gets the values appended to the pgTAP description as
-- well, which is how a failure explains itself under `supabase test db` where
-- this table is not printed.
create function tests.record(p_description text, p_passed boolean, p_detail text)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  -- The detail is kept only for a failure, so the report has nothing to read
  -- except on the rows that need explaining.
  insert into pg_temp.test_results (ok, description, detail)
  values (p_passed, p_description, case when p_passed then null else p_detail end);

  return ok(
    p_passed,
    case
      when p_passed or p_detail is null then p_description
      else p_description || ' (' || p_detail || ')'
    end
  );
end;
$$;

-- Compares two values as text and records the result. NULL is equal to NULL,
-- which is what pgTAP's own `is()` does, and NULL against anything else fails
-- rather than being quietly unknown.
create function tests.same(description text, have text, want text)
returns text
language sql
set search_path = pg_catalog, public, extensions
as $$
  select tests.record(
    description,
    have is not distinct from want,
    'have ' || coalesce(have, 'null') || ', want ' || coalesce(want, 'null')
  );
$$;

-- Records a statement that has already been decided, such as the result of one
-- of the helpers below.
create function tests.truthy(description text, passed boolean, detail text default null)
returns text
language sql
set search_path = pg_catalog, public, extensions
as $$
  select tests.record(description, passed, detail);
$$;

-- ---------------------------------------------------------------------------
-- running a statement as the caller
-- ---------------------------------------------------------------------------
--
-- Both of these are security invoker on purpose: the point of each is to run the
-- statement under whatever role the assertions have switched to, so the
-- policies are what answers. Neither one can be reached as anyone but the
-- caller, and this whole transaction is rolled back.
--

-- True when a write was refused. See the note at the top: an insert is refused
-- by raising, an update or a delete by matching nothing. Anything other than
-- `insufficient_privilege` or zero rows propagates.
create function tests.refused(sql text)
returns boolean
language plpgsql
as $$
declare
  affected integer;
begin
  execute sql;

  get diagnostics affected = row_count;

  return affected = 0;
exception
  when insufficient_privilege then
    return true;
end;
$$;

-- True when a statement ran without raising. This is pgTAP's `lives_ok` without
-- its pgTAP bookkeeping: a statement that does not run at all shows up here as a
-- failed assertion with its own description, which is what a `lives_ok` would
-- have reported too.
create function tests.lives(sql text)
returns boolean
language plpgsql
as $$
begin
  execute sql;

  return true;
exception when others then
  return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- fixtures
-- ---------------------------------------------------------------------------

-- Belt and braces. The rollback at the end means this file cannot leave anything
-- behind, so this is only here for rows something else left on the same ids: an
-- earlier version of this file that was committed, or a fixture inserted by hand
-- while working out what a policy does. Without it the unique index on
-- auth.users.email would refuse the two rows below. Scoped to the two ids used
-- here, so it cannot touch a real account, and undone by the same rollback as
-- everything else. The cascade takes their profiles, habits and check-ins too.
delete from auth.users where id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222'
);

-- Two users. The columns listed are the ones a row created outside the auth
-- server needs: raw_app_meta_data claims the email provider, which is what a user
-- created through /signup looks like, and raw_user_meta_data is what
-- `handle_new_user` turns into profiles.display_name.
--
-- Both metadata columns are jsonb, so the display name is built with
-- jsonb_build_object rather than by concatenating a string: `'{"a":"' || label ||
-- '"}'` is a text expression and jsonb will not take it.
--
-- instance_id is left out. It is nullable, and it is a foreign key into
-- auth.instances, so a made-up all-zero uuid would fail on the reference rather
-- than on anything this file is testing. Nothing in the migration or in the
-- policies reads it.
insert into auth.users (id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select id, 'authenticated', 'authenticated',
       email, 'not-a-real-hash', now(),
       jsonb_build_object(
         'provider', 'email',
         'providers', jsonb_build_array('email')
       ),
       jsonb_build_object('display_name', label),
       now(), now()
from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'rls-a@example.test'::text, 'A'::text),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'rls-b@example.test'::text, 'B'::text)
) as fixtures (id, email, label);

-- The habits and the check-ins are created as the user they belong to, with a
-- session, and that is not a formality. `set_row_user_id` is a before insert
-- trigger on both tables and it stamps `auth.uid()` over whatever was supplied,
-- so a fixture inserted by the admin role with no session gets a null owner and
-- the not-null constraint rejects the row. Impersonating the owner is the only
-- way to land the same owner the app would have put there, and the policies then
-- check that owner rather than being bypassed.
--
-- So these inserts do not carry `user_id` at all. The real client does not send
-- it either; see the trigger in 0001_init.sql. Only `id` is pinned, so the
-- assertions below can name the rows.
--
-- created_at is pinned to 2023 on the habits so the updated_at assertion later
-- can tell a restamped row from an untouched one: `now()` is the transaction
-- timestamp, so a row created in this same transaction would have updated_at
-- equal to created_at whether or not the trigger ran. The before update trigger
-- does not fire on an insert, so those two values survive.

-- A's rows.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aud":"authenticated"}',
  true);

insert into public.habits (id, name, monthly_goal, color, sort_order, created_at, updated_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'A read', 10, 'teal', 0, '2023-07-01T00:00:00Z', '2023-07-01T00:00:00Z'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'A run', 10, 'blue', 1, '2023-07-01T00:00:00Z', '2023-07-01T00:00:00Z');

insert into public.checkins (habit_id, date)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '2023-07-04'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '2023-07-05');

-- B's rows, created the same way. The habit has to exist before the check-in on
-- it, and both are created under B's session so the trigger stamps B.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aud":"authenticated"}',
  true);

insert into public.habits (id, name, monthly_goal, color, sort_order, created_at, updated_at)
values
  ('bbbbbbbb-0000-0000-0000-000000000001', 'B read', 10, 'purple', 0, '2023-07-01T00:00:00Z', '2023-07-01T00:00:00Z');

insert into public.checkins (habit_id, date)
values
  ('bbbbbbbb-0000-0000-0000-000000000001', '2023-07-04');

-- Back to the session role. The assertions below set their own role and claims,
-- and none of them create a row.
reset role;

-- Become user A.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aud":"authenticated"}',
  true);

-- ---------------------------------------------------------------------------
-- the profile trigger
-- ---------------------------------------------------------------------------

-- A row on auth.users must produce a profile, or every screen that shows a name
-- shows nothing.
select tests.same(
  'the signup trigger created a profile row',
  (select display_name from public.profiles
    where id = '11111111-1111-1111-1111-111111111111')::text,
  'A'
);

select tests.same(
  'a new profile defaults to the system theme',
  (select theme from public.profiles
    where id = '11111111-1111-1111-1111-111111111111')::text,
  'system'
);

-- ---------------------------------------------------------------------------
-- reads: A must not see B
-- ---------------------------------------------------------------------------

select tests.same(
  'A sees exactly A''s two habits',
  (select count(*) from public.habits)::text,
  '2'
);

select tests.same(
  'A sees none of B''s habits',
  (select count(*) from public.habits
    where user_id = '22222222-2222-2222-2222-222222222222')::text,
  '0'
);

select tests.same(
  'A sees exactly A''s two check-ins',
  (select count(*) from public.checkins)::text,
  '2'
);

select tests.same(
  'A sees none of B''s check-ins',
  (select count(*) from public.checkins
    where user_id = '22222222-2222-2222-2222-222222222222')::text,
  '0'
);

-- Become user B.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aud":"authenticated"}',
  true);

select tests.same(
  'B sees exactly B''s one habit',
  (select count(*) from public.habits)::text,
  '1'
);

select tests.same(
  'B sees exactly B''s one check-in',
  (select count(*) from public.checkins)::text,
  '1'
);

-- Become user A again.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aud":"authenticated"}',
  true);

-- ---------------------------------------------------------------------------
-- writes across accounts
-- ---------------------------------------------------------------------------

-- Each of these is attempted by A against a row that belongs to B. The important
-- one is the update: an update policy with no USING clause lets any signed-in
-- user rewrite anybody's rows, and nothing about the app would look wrong.
select tests.truthy(
  'A cannot update B''s habit',
  tests.refused(
    $$update public.habits set name = 'A was here'
      where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$)
);

select tests.truthy(
  'A cannot delete B''s habit',
  tests.refused(
    $$delete from public.habits where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$)
);

select tests.truthy(
  'A cannot update B''s check-in',
  tests.refused(
    $$update public.checkins set date = '2023-07-20'
      where habit_id = 'bbbbbbbb-0000-0000-0000-000000000001'$$)
);

select tests.truthy(
  'A cannot delete B''s check-in',
  tests.refused(
    $$delete from public.checkins
      where habit_id = 'bbbbbbbb-0000-0000-0000-000000000001'$$)
);

-- The one a user_id comparison alone would not catch. If the check-ins policies
-- trusted the denormalised user_id without also confirming the habit, this
-- insert would succeed and attribute a check-in to a habit A cannot even see.
select tests.truthy(
  'A cannot check in on B''s habit',
  tests.refused(
    $$insert into public.checkins (habit_id, date)
      values ('bbbbbbbb-0000-0000-0000-000000000001', '2023-07-06')$$)
);

-- ---------------------------------------------------------------------------
-- and nothing changed
-- ---------------------------------------------------------------------------

-- Reset to the session role, which is the role that applied the migration and so
-- bypasses row-level security. As A these five would each read no row and count
-- zero, which would look like the same answer whether or not A's attempt had
-- changed anything.
reset role;

select tests.same(
  'B''s habit is unchanged after A tried to update it',
  (select name from public.habits
    where id = 'bbbbbbbb-0000-0000-0000-000000000001')::text,
  'B read'
);

select tests.same(
  'B''s habit still exists after A tried to delete it',
  (select count(*) from public.habits
    where id = 'bbbbbbbb-0000-0000-0000-000000000001')::text,
  '1'
);

-- The expected day is cast to date and back to text as well, so both sides of the
-- comparison are printed the same way whatever the database's DateStyle is.
select tests.same(
  'B''s check-in still says the day it did',
  (select date from public.checkins
    where habit_id = 'bbbbbbbb-0000-0000-0000-000000000001')::text,
  '2023-07-04'::date::text
);

select tests.same(
  'B''s check-in still exists after A tried to delete it',
  (select count(*) from public.checkins
    where habit_id = 'bbbbbbbb-0000-0000-0000-000000000001')::text,
  '1'
);

select tests.same(
  'B''s habit still has only the check-in it started with',
  (select count(*) from public.checkins
    where habit_id = 'bbbbbbbb-0000-0000-0000-000000000001')::text,
  '1'
);

-- Back to A for the rest.
set local role authenticated;
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aud":"authenticated"}',
  true);

-- ---------------------------------------------------------------------------
-- ownership cannot be forged
-- ---------------------------------------------------------------------------

-- A before insert trigger fills user_id from the session, so a client that sends
-- somebody else's id gets its own id on the row. The insert being allowed is the
-- point; the next assertion is what matters.
select tests.truthy(
  'A can send somebody else''s user_id on insert',
  tests.lives(
    $$insert into public.habits (user_id, name, monthly_goal, color)
      values ('22222222-2222-2222-2222-222222222222', 'A forged', 5, 'coral')$$)
);

select tests.same(
  'the forged user_id was replaced with A''s own',
  (select user_id from public.habits where name = 'A forged')::text,
  '11111111-1111-1111-1111-111111111111'
);

-- ---------------------------------------------------------------------------
-- writes within one account still work
-- ---------------------------------------------------------------------------

-- Every policy blocked outright would pass all of the assertions above. These are
-- what stop this file being satisfied by an app where nothing works at all.
select tests.truthy(
  'A can create a habit of their own',
  tests.lives(
    $$insert into public.habits (name, monthly_goal, color, sort_order)
      values ('A swim', 8, 'yellow', 2)$$)
);

select tests.truthy(
  'A can archive their own habit',
  tests.lives(
    $$update public.habits set archived = true
      where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$)
);

select tests.truthy(
  'the updated_at trigger restamped the archived habit',
  coalesce(
    (select updated_at > created_at from public.habits
      where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
    false
  )
);

select tests.truthy(
  'A can check in on their own habit',
  tests.lives(
    $$insert into public.checkins (habit_id, date)
      values ('aaaaaaaa-0000-0000-0000-000000000002', '2023-07-06')$$)
);

select tests.same(
  'the check-in trigger stamped A as the owner',
  (select user_id from public.checkins
    where habit_id = 'aaaaaaaa-0000-0000-0000-000000000002'
      and date = '2023-07-06')::text,
  '11111111-1111-1111-1111-111111111111'
);

-- ---------------------------------------------------------------------------
-- no session, no rows
-- ---------------------------------------------------------------------------

-- auth.uid() is null without a session. If any policy were written as
-- `user_id is not null` rather than `user_id = auth.uid()`, this would find rows.
set local role anon;
select set_config('request.jwt.claims', '{}', true);

select tests.same(
  'a request with no session sees no habits',
  (select count(*) from public.habits)::text,
  '0'
);

select tests.same(
  'a request with no session sees no check-ins',
  (select count(*) from public.checkins)::text,
  '0'
);

select tests.same(
  'a request with no session sees no profiles',
  (select count(*) from public.profiles)::text,
  '0'
);

-- An update rather than an insert, on purpose. With no session the before insert
-- trigger writes a null owner, and whether that surfaces as a refusal by policy
-- or as a not-null violation is a Postgres check-order detail this file should
-- not be asserting. An update of a habit that exists is refused with no error at
-- all, which is the property worth stating: nothing is writable without a
-- session.
select tests.truthy(
  'a request with no session cannot change a habit',
  tests.refused(
    $$update public.habits set name = 'anon habit'
      where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$)
);

-- Back to the session role for pgTAP's own summary. It reads its bookkeeping out
-- of temp tables it created, and there is no reason to ask `anon` for that.
reset role;

select * from finish();

-- ---------------------------------------------------------------------------
-- the report
-- ---------------------------------------------------------------------------
--
-- The last query in the file, which is what the SQL Editor shows, since it shows
-- one result grid. One row per assertion in the order they ran, then the count. A
-- `not ok` row carries the values that disagreed in `detail`.
select
  num,
  case when ok then 'ok' else 'not ok' end as result,
  description,
  detail
from pg_temp.test_results

union all

select
  null::bigint,
  case
    when count(*) = count(*) filter (where ok) then 'ok'
    else 'not ok'
  end,
  format(
    '%s of %s passed%s',
    count(*) filter (where ok),
    count(*),
    case
      when count(*) = count(*) filter (where ok) then ''
      else ' - ' || (count(*) - count(*) filter (where ok)) || ' FAILED'
    end
  ),
  null::text
from pg_temp.test_results

order by num nulls last;

rollback;