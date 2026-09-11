# Security

## Row Level Security policies

RLS is enabled on `profiles`, `trips`, and `tasks` (verified: `pg_class.relrowsecurity =
true` for all three after migration). Every policy below is the **only** path to the data
it governs — there is no code path in the application that bypasses RLS to read or write
these tables (the app never uses the service-role key; see
[No service-role key in the app](#no-service-role-key-in-the-app)).

| Table      | Policy                  | Operation | Rule                                                                                                |
| ---------- | ----------------------- | --------- | --------------------------------------------------------------------------------------------------- |
| `profiles` | `profiles_select_own`   | select    | `id = auth.uid()`                                                                                   |
| `profiles` | `profiles_update_own`   | update    | `id = auth.uid()`                                                                                   |
| `trips`    | `trips_select_own`      | select    | `owner_id = auth.uid()`                                                                             |
| `trips`    | `trips_insert_own`      | insert    | `owner_id = auth.uid()` (also the column default)                                                   |
| `trips`    | `trips_update_own`      | update    | `owner_id = auth.uid()` (using + with check)                                                        |
| `trips`    | `trips_delete_own`      | delete    | `owner_id = auth.uid()`                                                                             |
| `tasks`    | `tasks_select_own_trip` | select    | trip referenced by `trip_id` is owned by `auth.uid()`                                               |
| `tasks`    | `tasks_insert_own_trip` | insert    | same, evaluated against the trip being inserted into                                                |
| `tasks`    | `tasks_update_own_trip` | update    | same, evaluated against **both** the current row (`using`) and the row being written (`with check`) |
| `tasks`    | `tasks_delete_own_trip` | delete    | same                                                                                                |

No insert/delete policy exists on `profiles` — creation is exclusively via
`handle_new_user()` (`security definer`, not callable by any client role — see below),
and account deletion is out of scope for this MVP.

### Why `tasks_update_own_trip` needs both `using` and `with check`

`using` alone only re-validates the row's state _before_ the update — it would let a user
update a task that already belongs to them and simply set `trip_id` to any value,
including another user's trip, since nothing would re-check the _new_ value. `with check`
closes that: it evaluates against the proposed new row, so re-pointing `trip_id` at a trip
you don't own is rejected. Verified in `unit-tests/integration/rls-tasks.test.ts` ("does
not let a user move their own task onto another user's trip").

### The `trips_with_status` view does not widen access

`trips_with_status` is declared `WITH (security_invoker = true)` — confirmed via
`pg_class.reloptions` after migration (`{security_invoker=true}`), and requires
PostgreSQL 15+ (this project runs 17.6). Without it, a view executes with the
_definer's_ privileges, which would bypass `trips`' RLS entirely. With it, every query
against the view runs as the querying user, so `trips_select_own` still applies —
confirmed in `unit-tests/integration/rls-trips.test.ts` (an anonymous client gets a
permission error from the view, and a signed-in user only ever sees their own 4 trips
through it).

## Grants: `anon` gets nothing on these tables

Supabase's default local/hosted setup exposes new `public` tables to PostgREST for both
`anon` and `authenticated` by default. This project explicitly revokes that for `anon` on
all three domain tables and the view (`revoke all on public.<table> from anon;`) — RLS
alone would already return zero rows to `anon` (there is no `anon`-targeting policy on any
of these tables), but the explicit revoke means an unauthenticated request gets a
table-level "permission denied" (`42501`) rather than depending solely on RLS filtering.
`authenticated` gets exactly `select, insert, update, delete` — no more.

`compute_trip_status(date, date)` is a pure function (two date inputs, no table access,
`stable`, not `security definer`) — granted to both `anon` and `authenticated` since it
cannot leak anything it wasn't already given as arguments.

## Function hardening

| Function                                                           | Definer?           | `search_path`                                                                                        | `EXECUTE` grant                                                                 |
| ------------------------------------------------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `handle_new_user()`                                                | `security definer` | `''` (empty), every reference fully qualified (`public.profiles`)                                    | revoked from `public` — only ever invoked by the `on_auth_user_created` trigger |
| `set_updated_at()`                                                 | invoker            | `''`                                                                                                 | revoked from `public` — trigger-only                                            |
| `normalize_profiles()` / `normalize_trips()` / `normalize_tasks()` | invoker            | `''`                                                                                                 | revoked from `public` — trigger-only                                            |
| `compute_trip_status(date, date)`                                  | invoker            | n/a (no unqualified table/type refs beyond the `public.trip_status` enum, which is schema-qualified) | granted to `anon`, `authenticated` — meant to be called directly                |

`search_path = ''` on the `security definer` function is the important one: with a
non-empty `search_path` (even `public`), a same-named object placed earlier in some
session's effective path could be resolved instead of the intended one, since
`security definer` functions otherwise run with whatever `search_path` the _caller's_
session has configured. An empty `search_path` forces every reference to be schema-qualified,
which the function already does (`public.profiles`) — built-ins like `btrim()`/`now()`
still resolve because `pg_catalog` is implicitly searched regardless of `search_path`.

Triggers do not require the invoking role to hold `EXECUTE` on the trigger function
(this is standard PostgreSQL behavior, not something configured here) — revoking
`EXECUTE` from `PUBLIC` on all of the above does not break `on_auth_user_created` or the
`updated_at`/normalize triggers; it only stops a client from calling them directly via
`rpc()`.

### `handle_new_user()` name validation

Reads `new.raw_user_meta_data ->> 'name'`, trims it, and explicitly rejects (raising
`errcode 23514`, the same code a `check` violation uses) each of: metadata absent, key
absent, empty string, whitespace-only, and longer than 120 characters. Because this runs
inside the same transaction as the `auth.users` insert, a rejection here aborts user
creation entirely — there is no code path that leaves an `auth.users` row without a
matching `profiles` row. Verified in
`unit-tests/integration/profiles.test.ts` (signup without a valid name leaves no orphaned
user, checked via `auth.admin.listUsers()`).

## No service-role key in the app

`SUPABASE_SERVICE_ROLE_KEY` does not appear in `.env.example`, `docker-compose.yml`, or
any application code. The only two places it is used at all:

1. `supabase/seed-users.mjs` — a local, developer-invoked script (never imported by the
   app, never runs in the Docker image).
2. `unit-tests/integration/helpers.ts` `adminClient()` — test setup/inspection only (e.g.
   looking up a seeded trip's id by name), never used to make the actual RLS assertions.

Both obtain it fresh from `supabase status -o json` at run time — never from
`process.env`, `.env.local`, or any file — so there is no path by which a hosted
project's key could be picked up by mistake, and nothing to accidentally commit.

## `seed-users.mjs` safety model {#seed-script}

Why not plain SQL `insert into auth.users ...`: GoTrue's password hashing/salting is not
a documented, stable format to replicate with `crypt()` — the community-reported failure
mode is `Invalid credentials` on login after a hand-rolled hash doesn't match what GoTrue
itself would have produced. The maintainer-endorsed approach is the Admin API
(`auth.admin.createUser`), which delegates hashing to GoTrue.

Before doing anything else, the script:

1. Runs `supabase status -o json` (never reads env vars for this).
2. Parses the URL with `new URL()` and requires, by strict equality (not `.includes()`):
   `protocol === "http:"`, `hostname` ∈ `{localhost, 127.0.0.1, ::1}`, a non-empty
   `port`, and no embedded userinfo (`user:pass@host`).
3. Exits non-zero immediately if the CLI call fails, the output isn't parseable JSON, or
   any of the above checks fail — before the service-role key is ever read into a
   variable that's used for anything.

The service-role key itself is never `console.log`'d (not even partially) and never
written to a file — it exists only as an in-memory value passed to `createClient()`.

### Idempotency

Re-running `npm run db:seed:users` without a prior `supabase db reset` converges to the
same state rather than erroring or duplicating data:

- Each of the two fixed test emails is looked up by attempting `createUser()` first; on a
  "user already exists" response, the existing user is found via `listUsers()` and
  reconciled (`updateUserById` resets its password/`email_confirm`/name to the expected
  values) — never re-created.
- That user's trips are deleted and re-inserted, but the delete is scoped to
  `trips.owner_id = <that one seed user's id>` — never a broad or unscoped delete, and
  never touches any user outside the two fixed seed emails. Tasks disappear with their
  trip via `ON DELETE CASCADE`.
- IDs (trip/task UUIDs) are not stable across re-seeds; the number of users, number of
  trips per user, ownership, and the mix of status categories and task states are.
