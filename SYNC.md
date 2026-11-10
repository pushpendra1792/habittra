# Offline cache and sync

Habittra keeps a copy of what this browser has seen in IndexedDB, and holds
writes that could not reach Supabase in a queue. The tracker can therefore open
and accept taps without a connection. Supabase is still the source of truth; the
local copy is a cache, not a second database.

## What is cached

Two kinds of record live in the `habittra-local` IndexedDB database:

| Record     | What it holds                                              |
| ---------- | ---------------------------------------------------------- |
| habits     | Every habit for the signed-in user, archived ones included |
| check-ins  | One month of check-ins per record, for every month opened  |
| sync queue | That user's pending and failed operations                  |

Every cache key starts with the user id, for example
`user:<user-id>:habits` or `user:<user-id>:checkins:2026-11`. A shared browser
can hold two accounts' cached data at once; one account cannot read the other's
records by asking for a month or a habit list.

On sign-in the app copies this user's cached records into the TanStack Query
cache before the tracker mounts, then marks those queries stale so they refresh
from Supabase in the background. On a fast connection the refresh wins and the
local copy is replaced. Offline, the failed refresh leaves the cached copy on
screen rather than turning the tracker into an error panel.

Only months that have been opened on this browser are cached. A month with no
local record still needs the network the first time it is opened.

## The queue

A write that cannot reach Supabase is saved as one operation, with:

- the user id;
- a client-generated queue id;
- the time it was made;
- a retry count;
- the operation kind and its data.

There are four kinds:

| Operation        | Used for                                          |
| ---------------- | ------------------------------------------------- |
| `add_checkin`    | Ticking a cell                                    |
| `remove_checkin` | Clearing a cell                                   |
| `create_habit`   | Adding a habit, including its client-generated id |
| `update_habit`   | Rename, goal, colour, archive, restore, reorder   |

The online path is still tried first. If the server accepts the write, nothing
is queued. If the request fails because the network is down, the browser is
offline, or the session has expired, the operation is appended to the queue and
the optimistic cache stays in place. If the server rejects the write with a
permanent rule error, the optimistic change is rolled back and a toast explains
the failure, as it did before offline support.

When the browser is online the queue is replayed from the front, in order. A
check-in for a habit that was created offline is behind that habit's create,
because the create was enqueued first. Replay continues past a permanent failure
so one bad operation does not block everything behind it. Network failures keep
the operation in place and retry with backoff (1s, 2s, 4s, up to 30s). Auth
failures pause the queue without dropping anything; it resumes when a valid
session is available or the user taps Retry.

Replay is idempotent:

- adding a check-in upserts on `(habit_id, date)`, so a retry rewrites the same
  row;
- removing a check-in deletes on `(habit_id, date)`, and deleting a row that is
  already gone is not an error;
- creating a habit upserts on the client-generated id, so a response lost after
  the row landed cannot create a second habit;
- editing and reordering are patches, so applying the same patch twice has the
  same result.

## Conflicts and cancellation

For one `(habit, date)` cell, only the user's latest answer is kept before
replay. Add then remove becomes a remove; remove then add becomes an add. A tap
made after the queue has already started still ends up in the queue and is
replayed after the in-flight pass.

Habit changes are field-level patches. If two devices change different fields,
both changes survive. If they change the same field, the patch that reaches the
server last wins. Reorder writes a sort order per habit; the last reorder for a
habit wins. Check-ins for one cell follow the same final-answer rule as the local
queue.

After the queue drains, the app invalidates the habit list and cached months so
Supabase's copy replaces the optimistic one. The tracker does not silently
invent a merge UI or a conflict dialog.

## The header indicator

- **Synced**: online, queue empty.
- **Syncing**: a replay pass is in progress.
- **Offline · n**: offline or a request just failed, with `n` pending changes.
  The number is the queue length, not the number of rows on screen.
- **Sync error · Retry**: a permanent failure went to the failed list, or an
  expired session paused the queue. Tapping puts the failed items back in the
  queue and tries again. A permanent failure is announced once with a toast; the
  failed entry is saved, so a reload does not repeat the toast.

There is no popup. The indicator is status text with one retry button.

## Sign-out

Signing out clears every cached habit, cached month and queued operation from
IndexedDB on this browser, not only the account that signed out. A later
sign-in starts from Supabase rather than from a previous account's rows.

That also means an unsynced change is discarded if you sign out before the queue
has had a chance to replay. The indicator shows the pending count and the sync
state before you sign out; wait for **Synced** if the change matters.

## What is not covered

- The service worker caches the app shell, but it does not make Supabase
  requests work. Offline reads come from the IndexedDB cache described above.
- There is no background sync API integration. Replay runs while the app is open
  and the browser reports that it is online.
- There is no UI for inspecting the failed list beyond the header count and the
  retry action.
- Signed-in browser automation is not mocked. `/` is behind real Supabase auth,
  so the unit tests cover the queue, cache keys and mutation outcomes, while the
  end-to-end suite still covers the unauthenticated screens only.
