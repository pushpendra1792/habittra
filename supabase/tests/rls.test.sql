-- Row-level security: one account must not be able to read, change or fake data
-- for another.
--
-- This is the only check in the repo that proves anything about the database.
-- Everything else is TypeScript running against pure functions, which cannot tell
-- you whether a policy is right.
--
-- NOT RUN YET. It was written without a Supabase project to point at. Run it
-- before trusting the policies:
--
--   npx supabase start
--   npx supabase test db supabase/tests/rls.test.sql
--
-- Against the hosted project, enable pgTAP once and paste the file into the SQL
-- Editor:
--
--   create extension if not exists pgtap;
--
-- How it works. It creates two throwaway auth users, A and B, gives each one
-- habit, and then switches between them the way Supabase switches for a real
-- request: by setting the role and the JWT claims. Every assertion is one user
-- doing something to a row belonging to the other.
--
-- Everything is in a transaction that is rolled back at the end, so it leaves
-- nothing behind. The dropping of the fixtures is belt and braces for the case
-- where someone runs this with autocommit on.
--
-- Note on the shape of this file. A forbidden write raises, which would abort the
-- transaction, so each one goes through `rls_denied`, which catches
-- `insufficient_privilege` and nothing else. A typo in one of those statements
-- therefore fails the test rather than quietly counting as a rejection: an
-- unexpected SQLSTATE propagates out and stops the run.

begin;

-- pgTAP installs into `extensions` on a hosted project and into `public` on a
-- local stack. Both are searched, so this file runs either way.
set local search_path = public, extensions;

create schema if not exists tests;

select plan(29);

-- ---------------------------------------------------------------------------
-- fixtures
-- ---------------------------------------------------------------------------

-- Two users. The columns listed are the ones auth.users has no default for.
-- raw_app_meta_data claims the email provider, which is what a user created
-- through /signup looks like, and raw_user_meta_data is what the trigger below
-- turns into profiles.display_name.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                        created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated',
       email, 'not-a-real-hash', now(),
       '{"provider":"email","providers":["email"]}',
       '{"display_name":"' || label || '"}',
       now(), now()
from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'rls-a@example.test'::text, 'A'::text),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'rls-b@example.test'::text, 'B'::text)
) as fixtures (id, email, label);

-- B's rows, plus A's. created_at is pinned to 2023 so the updated_at assertion
-- below can tell a restamped row from an untouched one: `now()` is the
-- transaction timestamp, so a row created in this same transaction would have
-- updated_at equal to created_at whether or not the trigger ran.
insert into public.habits (id, user_id, name, monthly_goal, color, sort_order, created_at, updated_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111',
   'A read', 10, 'teal', 0, '2023-07-01T00:00:00Z', '2023-07-01T00:00:00Z'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111',
   'A run', 10, 'blue', 1, '2023-07-01T00:00:00Z', '2023-07-01T00:00:00Z'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222',
   'B read', 10, 'purple', 0, '2023-07-01T00:00:00Z', '2023-07-01T00:00:00Z');

insert into public.checkins (habit_id, user_id, date)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '2023-07-04'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '2023-07-05'),
  ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-2222-222222222222', '2023-07-04');

-- Runs a statement and reports whether it was refused by a policy. Only
-- `insufficient_privilege`, which is what PostgREST surfaces for a row the
-- policies exclude, counts as a refusal. Anything else propagates and fails.
create function tests.rls_denied(sql text)
returns boolean
language plpgsql
as $$
begin
  execute sql;

  return false;
exception
  when insufficient_privilege then
    return true;
end;
$$;

-- Become user A.
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aud":"authenticated"}',
  true);

-- ---------------------------------------------------------------------------
-- the profile trigger
-- ---------------------------------------------------------------------------

-- A row on auth.users must produce a profile, or every screen that shows a name
-- shows nothing.
select is(
  (select display_name from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'),
  'A',
  'the signup trigger created a profile row'
);

select is(
  (select theme from public.profiles
    where id = '11111111-1111-1111-1111-111111111111'),
  'system',
  'a new profile defaults to the system theme'
);

-- ---------------------------------------------------------------------------
-- reads: A must not see B
-- ---------------------------------------------------------------------------

select is(
  (select count(*) from public.habits),
  2::bigint,
  'A sees exactly A''s two habits'
);

select is(
  (select count(*) from public.habits
    where user_id = '22222222-2222-2222-2222-222222222222'),
  0::bigint,
  'A sees none of B''s habits'
);

select is(
  (select count(*) from public.checkins),
  2::bigint,
  'A sees exactly A''s two check-ins'
);

select is(
  (select count(*) from public.checkins
    where user_id = '22222222-2222-2222-2222-222222222222'),
  0::bigint,
  'A sees none of B''s check-ins'
);

-- Become user B.
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims',
  '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aud":"authenticated"}',
  true);

select is(
  (select count(*) from public.habits),
  1::bigint,
  'B sees exactly B''s one habit'
);

select is(
  (select count(*) from public.checkins),
  1::bigint,
  'B sees exactly B''s one check-in'
);

-- Become user A again.
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aud":"authenticated"}',
  true);

-- ---------------------------------------------------------------------------
-- writes across accounts: refused, and nothing changed
-- ---------------------------------------------------------------------------

-- The important one. An update policy with no USING clause lets any signed-in
-- user rewrite anybody's rows, and nothing about the app would look wrong.
select is(
  tests.rls_denied(
    $$update public.habits set name = 'A was here'
      where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$),
  true,
  'A cannot update B''s habit'
);

select is(
  (select name from public.habits where id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  'B read',
  'B''s habit is unchanged after A tried to update it'
);

select is(
  tests.rls_denied(
    $$delete from public.habits where id = 'bbbbbbbb-0000-0000-0000-000000000001'$$),
  true,
  'A cannot delete B''s habit'
);

select is(
  (select count(*) from public.habits where id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  1::bigint,
  'B''s habit still exists after A tried to delete it'
);

select is(
  tests.rls_denied(
    $$update public.checkins set date = '2023-07-20'
      where habit_id = 'bbbbbbbb-0000-0000-0000-000000000001'$$),
  true,
  'A cannot update B''s check-in'
);

select is(
  (select date from public.checkins
    where habit_id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  '2023-07-04'::date,
  'B''s check-in still says the day it did'
);

select is(
  tests.rls_denied(
    $$delete from public.checkins
      where habit_id = 'bbbbbbbb-0000-0000-0000-000000000001'$$),
  true,
  'A cannot delete B''s check-in'
);

select is(
  (select count(*) from public.checkins
    where habit_id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  1::bigint,
  'B''s check-in still exists after A tried to delete it'
);

-- ---------------------------------------------------------------------------
-- the habit ownership check on check-ins
-- ---------------------------------------------------------------------------

-- The one a user_id comparison alone would not catch. If the check-ins policies
-- trusted the denormalised user_id without also confirming the habit, this insert
-- would succeed and attribute a check-in to a habit A cannot even see.
select is(
  tests.rls_denied(
    $$insert into public.checkins (habit_id, date)
      values ('bbbbbbbb-0000-0000-0000-000000000001', '2023-07-06')$$),
  true,
  'A cannot check in on B''s habit'
);

select is(
  (select count(*) from public.checkins
    where habit_id = 'bbbbbbbb-0000-0000-0000-000000000001'),
  1::bigint,
  'B''s habit still has only the check-in it started with'
);

-- ---------------------------------------------------------------------------
-- ownership cannot be forged
-- ---------------------------------------------------------------------------

-- A before insert trigger fills user_id from the session, so a client that sends
-- somebody else's id gets its own id on the row. The insert being allowed is the
-- point; the next assertion is what matters.
select lives_ok(
  $$insert into public.habits (user_id, name, monthly_goal, color)
    values ('22222222-2222-2222-2222-222222222222', 'A forged', 5, 'coral')$$,
  'A can send somebody else''s user_id on insert'
);

select is(
  (select user_id from public.habits where name = 'A forged')::text,
  '11111111-1111-1111-1111-111111111111',
  'the forged user_id was replaced with A''s own'
);

-- ---------------------------------------------------------------------------
-- writes within one account still work
-- ---------------------------------------------------------------------------

-- Every policy blocked outright would pass all of the assertions above. These are
-- what stop this file being satisfied by an app where nothing works at all.
select lives_ok(
  $$insert into public.habits (name, monthly_goal, color, sort_order)
    values ('A swim', 8, 'yellow', 2)$$,
  'A can create a habit of their own'
);

select lives_ok(
  $$update public.habits set archived = true
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  'A can archive their own habit'
);

select is(
  (select updated_at > created_at from public.habits
    where id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  true,
  'the updated_at trigger restamped the archived habit'
);

select lives_ok(
  $$insert into public.checkins (habit_id, date)
    values ('aaaaaaaa-0000-0000-0000-000000000002', '2023-07-06')$$,
  'A can check in on their own habit'
);

select is(
  (select user_id from public.checkins
    where habit_id = 'aaaaaaaa-0000-0000-0000-000000000002'
      and date = '2023-07-06')::text,
  '11111111-1111-1111-1111-111111111111',
  'the check-in trigger stamped A as the owner'
);

-- ---------------------------------------------------------------------------
-- no session, no rows
-- ---------------------------------------------------------------------------

-- auth.uid() is null without a session. If any policy were written as
-- `user_id is not null` rather than `user_id = auth.uid()`, this would find rows.
select set_config('role', 'anon', true);
select set_config('request.jwt.claims', '{}', true);

select is(
  (select count(*) from public.habits),
  0::bigint,
  'a request with no session sees no habits'
);

select is(
  (select count(*) from public.checkins),
  0::bigint,
  'a request with no session sees no check-ins'
);

select is(
  (select count(*) from public.profiles),
  0::bigint,
  'a request with no session sees no profiles'
);

select is(
  tests.rls_denied(
    $$insert into public.habits (name, monthly_goal, color)
      values ('anon habit', 3, 'teal')$$),
  true,
  'a request with no session cannot create a habit'
);

select * from finish();

rollback;

drop function if exists tests.rls_denied(text);
drop schema if exists tests cascade;