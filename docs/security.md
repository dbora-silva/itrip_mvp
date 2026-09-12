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

## Authentication (Phase 5)

### Package versions and the actual dependency direction

`@supabase/ssr` and `@supabase/supabase-js` version independently — `@supabase/ssr` does
**not** pin an exact `@supabase/supabase-js` version, and `@supabase/supabase-js` does not
depend on `@supabase/ssr` at all (confirmed via `npm view <pkg> dependencies
peerDependencies`). The real relationship: `@supabase/ssr@0.12.7` declares
`peerDependencies: { "@supabase/supabase-js": "^2.114.0" }`, which our installed
`@supabase/supabase-js@2.116.0` satisfies. An earlier draft of this plan stated the
direction backwards ("supabase-js requires ssr ^2.114.0") — that was a wording error, not
a version mismatch; corrected here.

### Session cookies — exact, verified behavior

Verified directly against `@supabase/ssr@0.12.7`'s installed source
(`node_modules/@supabase/ssr/dist/module/utils/constants.js`,
`DEFAULT_COOKIE_OPTIONS`) and confirmed by grepping the whole package for `secure`
(zero matches — the library never sets it):

| Option     | Library default                   | What this project does                                                                                                                                                                                            |
| ---------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `httpOnly` | `false`                           | Kept as-is (see below)                                                                                                                                                                                            |
| `sameSite` | `lax`                             | Kept as-is                                                                                                                                                                                                        |
| `path`     | `/`                               | Kept as-is                                                                                                                                                                                                        |
| `maxAge`   | 400 days                          | Kept as-is                                                                                                                                                                                                        |
| `secure`   | **not set by the library at all** | Set explicitly: `true` when `NODE_ENV === "production"`, `false` otherwise — see `lib/supabase/env.ts` `getSupabaseCookieOptions()`, applied in all three client factories (`client.ts`, `server.ts`, `proxy.ts`) |

**Scope and duration:** cookies are set on `path=/` (readable by every route of this
app) for up to 400 days, refreshed by `proxy.ts` on every navigation that hits a
non-excluded path. The actual _session_ validity is governed by the JWT's own expiry
(`jwt_expiry = 3600`, one hour, in `supabase/config.toml`) and refresh token rotation
(`enable_refresh_token_rotation = true`) — a stale 400-day-old cookie with an expired,
already-rotated refresh token is simply rejected by Auth, not implicitly trusted.

**`httpOnly: false` — why it's kept, and what it actually means:**
`@supabase/ssr`'s browser client reads the session cookie directly via
`document.cookie` (there is no other supported way for it to know the session
client-side without a network round trip on every page). Setting `httpOnly: true` would
make the cookie invisible to that client entirely. This project keeps the library
default, as instructed.

**This is a real XSS exposure, not a theoretical one:** any JavaScript that runs on this
origin — including injected via a successful XSS — can read `document.cookie` and
exfiltrate the session token. A short-lived access token (1h) and refresh token rotation
**reduce the impact and window of a stolen token**, but they are not a substitute for
preventing XSS in the first place: a token stolen the moment it's minted is fully valid
until it expires, and rotation only helps if the legitimate client refreshes first — it
does not stop a race. **The actual XSS prevention in this project is: React's default
JSX escaping (no `dangerouslySetInnerHTML` is used anywhere in this phase) and never
rendering unsanitized user-supplied HTML.** If a future phase introduces rendering of
untrusted HTML (e.g. rich text), that is the point where this cookie posture must be
revisited (sanitization, or reconsidering `httpOnly`).

**No manual token storage:** this project never reads, writes, or duplicates the
session into `localStorage`, `sessionStorage`, or any other client-side store —
`@supabase/ssr`'s cookie handling is the only place the token lives on the client.

### `getClaims()` — only what is proven, not presumed

`proxy.ts` and `app/dashboard/layout.tsx` both use `getClaims()`, never `getSession()`
(which only reads what's in the cookie without verifying it's still valid — not
sufficient for an authorization decision). What is actually verified, from the
installed `@supabase/auth-js` source
(`node_modules/@supabase/auth-js/dist/module/GoTrueClient.js`, `getClaims()` JSDoc,
`fetchJwk()`, and the `GLOBAL_JWKS` module-level cache) and from a direct test against
the local instance:

- **If the project signs JWTs with an asymmetric key** (ES256/RS256), `getClaims()`
  verifies the signature locally via WebCrypto against a JWKS
  (`/.well-known/jwks.json`), fetched once and cached in a **module-level** object
  (`GLOBAL_JWKS`, keyed by the client's storage key) — not per client instance. This
  matters here specifically because `lib/supabase/server.ts` and `lib/supabase/proxy.ts`
  both create a **fresh Supabase client on every request** (an explicit `@supabase/ssr`
  requirement); without the cache being module-scoped rather than instance-scoped, that
  would defeat caching entirely. Because it's module-scoped, the cache is shared across
  requests handled by the same server process for the cache's TTL.
- **If the project signs JWTs with the legacy symmetric secret (HS256)**, the installed
  source states plainly: _"it always sends a request similar to `getUser()` to validate
  the JWT at the server"_ — no local-verification branch exists for that case at all.

**Correction to an earlier draft of this document:** this project's local instance was
previously (Phase 5) assumed to sign JWTs with the legacy symmetric secret, based on the
`JWT_SECRET` value `supabase status` prints. That assumption was wrong, and is corrected
here rather than left standing: decoding a real access token obtained via
`signInWithPassword()` shows header `{"alg":"ES256","kid":"..."}` — this project's local
Supabase CLI provisions an **asymmetric** signing key by default (no
`signing_keys_path` is configured in `supabase/config.toml`; the `JWT_SECRET` shown by
`supabase status` is a separate, legacy value still used only to sign the static
`anon`/`service_role` API keys, which remain HS256 — confirmed by decoding those
separately). Re-run empirically for this phase: four consecutive `getClaims()` calls
against the same client measured 9.03ms, then 0.59ms, 0.45ms, 0.54ms — a >15x drop after
the first call, consistent with a one-time JWKS fetch followed by local WebCrypto
verification, not a per-call network round trip.

**Current, verified consequence:** `proxy.ts` and `app/dashboard/layout.tsx` pay one
network call the first time any client in the process calls `getClaims()` (JWKS fetch),
and verify locally thereafter for the JWKS's TTL. This is the opposite of what the
earlier draft claimed. If a future environment (hosted or reconfigured local) signs with
the legacy symmetric secret instead, the code path above shows this would silently
degrade to a `getUser()`-equivalent network call every time — worth re-verifying if the
signing configuration ever changes, rather than assumed to still be asymmetric.

- If the access token is close to expiring when `getClaims()` is called, the session is
  refreshed first (another network round trip) before the JWT is validated.

### Redirect allowlist (`lib/auth/redirect.ts`)

Allowlist, not blocklist: the only accepted destinations after login are `/dashboard`
itself or a path segment directly under it, matched against the _decoded_ pathname with
`/^\/dashboard(\/[a-zA-Z0-9_-]+)*$/` after parsing with `new URL(candidate,
"https://itrip.local")` and requiring `url.origin` to still equal that fixed trusted
origin. This is what rejects, all verified by
`unit-tests/lib/auth/redirect.test.ts`: absolute external URLs, protocol-relative
(`//host/...`) URLs, a leading backslash (which the WHATWG URL parser treats as a path
separator for `http`/`https`, and which could otherwise smuggle a different host through
undetected by an origin check alone), `javascript:` and other non-`http(s)` schemes,
percent-encoded traversal sequences (checked against the _decoded_ path, since the URL
parser's own dot-segment normalization does not resolve encoded `%2e%2e`), literal
control characters, and — simply by not being in the allowlist — `/login`, `/cadastro`,
and every other public route. Anything that doesn't unambiguously match falls back to
`/dashboard`. `/login?next=...` is always built with `URLSearchParams`
(`buildLoginRedirectUrl`), never manual string concatenation.

### No redirect loop, by construction

`lib/auth/proxy-decision.ts`'s `decideProxyAction()` has exactly two redirect-producing
branches — private path + unauthenticated → `/login?next=...`, and `/login`/`/cadastro`

- authenticated → `/dashboard` — and they are mutually exclusive by pathname, so neither
  branch's own output can trigger the other branch again for the same auth state. This is
  asserted directly in `unit-tests/lib/auth/proxy-decision.test.ts`, including a test that
  re-feeds each produced redirect target back into the function and asserts the result is
  `{ action: "next" }`. Because the redirect allowlist above never allows `/login` or
  `/cadastro` as a post-login destination, even an attacker-supplied `next=/login` cannot
  reintroduce a loop.

### Server Actions and authorization

`signIn` and `signUp` are intentionally public — anyone must be able to call them to
authenticate at all. `signOut` checks `getClaims()` before deciding whether to actually
call `supabase.auth.signOut()`, but always redirects to `/login` regardless of whether a
session existed — a caller cannot distinguish "you had a session and it was ended" from
"you had no session" from the response, which avoids leaking session state to an
unauthenticated caller probing the endpoint.

**Rule for every future Server Action that touches private data (trips, tasks, ...):**
authentication must be re-checked _inside_ that action, not assumed from `proxy.ts`
having run. Next.js's own documentation for `proxy.ts` states this directly: Server
Functions are not separate routes for matcher purposes, so a proxy matcher that excludes
a path also skips proxy coverage for Server Actions invoked from it — a routing change
elsewhere could silently remove protection an action was implicitly relying on. This
project's proxy matcher does not currently exclude any app path (only `_next/static`,
`_next/image`, `favicon.ico`, and `/api/`), but the rule holds regardless: it is not
implemented yet because no CRUD actions exist yet in this phase.

### `redirect()` and error handling in the same action

Next.js's `redirect()` works by throwing a special, framework-internal value that must
propagate up to Next.js's own handling — catching it in an application `try/catch` (even
accidentally, via a broad catch) would turn a successful sign-in/signup into a reported
failure. `features/auth/actions.ts` structures every action so the Supabase call and its
error handling happen inside a `try/catch` that only sets a `failed` boolean, and
`redirect()` is called strictly _after_ that block ends — never lexically inside it —
so there is no catch clause positioned to intercept it.

### Sign-up: not every "no error" response is treated as a valid session

`features/auth/signup-outcome.ts`'s `interpretSignUpResult()` inspects both `error` and
`data.session` before deciding an outcome, rather than assuming "no error" means
"session created": a `user_already_exists` / `email_exists` error code maps to
`duplicate_email`, and — separately — a `null` `error` with no `data.session` maps to
`no_session` (defensive: this project's local configuration, confirmed by direct test
against the local instance, returns a `user_already_exists` _error_ for a duplicate
signup rather than an ambiguous no-session success, so `no_session` is not currently
reproducible here, but the action does not assume that will always hold). `duplicate_email`,
`no_session`, and any other `error` all produce the _same_ generic user-facing message
and never trigger a redirect to `/dashboard` — only `{ kind: "success" }`
(non-null `data.session`) does.

### Logging

`lib/auth/log.ts`'s `logAuthError()` accepts an operation name and an error value, and
extracts only a coarse category from it (the Supabase error's `code`, or a plain
`Error`'s `name`, or `"unknown"`) — never `.message`, never the caught value itself,
never form data, passwords, cookies, JWTs, or full Supabase response objects. There is no
parameter through which a caller could pass any of those in, by construction — the
function's only inputs are the operation name, the error, and an optional correlation id.

## Trips CRUD (Phase 6)

### Search is a SQL function, not a hand-built `.or()` filter

`features/trips/queries.ts` calls the `search_trips(p_search, p_status)` RPC
(`supabase/migrations/20260911212923_create_search_trips_function.sql`) instead of
building a `postgrest-js` `.or()` filter string in application code. Two things were
verified before choosing this, not assumed:

- Reading `node_modules/@supabase/postgrest-js/src/PostgrestFilterBuilder.ts`'s `or()`
  method: it does no escaping at all — the string passed in is used exactly as given,
  only wrapped in an outer `()`. `.in()`/`.contains()` elsewhere in the same file _do_
  escape (wrapping a value in double quotes when it contains `,`, `(`, or `)`), but
  `.or()` has no equivalent.
- PostgREST's own documentation describes no complete, official recipe for escaping
  arbitrary user text inside `or=` — only that a filter _value_ with a reserved
  character needs double-quoting, which doesn't cover the shape of a hand-built
  `name.ilike.%x%,destination.ilike.%x%` string where the user-typed text could itself
  contain `,`/`(`/`)`.

This was never a data-exposure risk — RLS still governs every row regardless of how a
malformed filter string parses — but a robustness one: a search term with those
characters could produce a PostgREST syntax error surfaced to the user. `search_trips`
avoids the question entirely: `p_search` is a normal bound SQL parameter, never
string-concatenated into anything.

`search_trips` is `security invoker` (the default for `language sql` functions, stated
explicitly anyway), `set search_path = ''`, revoked from `public` and `anon`, granted
only to `authenticated`. Because it runs as the calling role and reads from
`public.trips`, `trips_select_own` applies exactly as it would to a direct `select` —
the function grants no visibility beyond what RLS already allows that caller. Verified
directly (`unit-tests/integration/trips.test.ts`): an anonymous client calling the RPC
gets `42501` (`permission denied for function search_trips`); a signed-in user never
sees another user's rows through it.

`%` and `_` (SQL `LIKE` wildcards) are escaped to be matched **literally** inside the
function (`replace(..., '%', '\%')` / `'_', '\_'` with `escape '\'`), since this is
user-typed search text, not a pattern the user intends to author — confirmed by test:
searching `%` alone returns zero results rather than every row. `left(btrim(p_search),
200)` bounds the term length before it's ever used in a pattern.

Sorting is fixed inside the same function (ongoing → upcoming → planning → completed as
groups, ascending `start_date` within every group except `completed`, which sorts
descending) — the client cannot choose an arbitrary `order by` expression, and the rule
lives in exactly one place in SQL, never duplicated in TypeScript.

### `status` cannot be written — verified, not assumed

An earlier draft of the Phase 6 plan claimed PostgREST "ignores" an unknown column like
`status` in an insert/update payload. That was wrong and is corrected here: `status` is
not a column of `trips` at all (it only exists on the `trips_with_status` view, computed
by `compute_trip_status()`), and PostgREST **rejects** the whole request when the
payload references it. Verified empirically against the local instance, both via `curl`
with a real signed-in access token and via `unit-tests/integration/trips.test.ts`:

```
POST /rest/v1/trips  { ..., "status": "completed" }
→ 400 Bad Request, code PGRST204
  "Could not find the 'status' column of 'trips' in the schema cache"
```

No row is created (verified by a follow-up select). The identical rejection happens on
`PATCH` with `status` in the body, and the target row is confirmed unchanged. An
`owner_id` pointed at a different user is rejected differently — `42501`, an RLS
`with check` violation on `trips_insert_own` — since `owner_id` is a real column; the
column default (`default auth.uid()`) is what supplies it, and
`features/trips/actions.ts` never includes `owner_id` in the objects it sends to
`.insert()`/`.update()` at all.

`features/trips/schemas.ts`'s `tripFormSchema` uses `z.strictObject(...)`, so a payload
carrying an unrecognized key (`status`, `owner_id`, `id`, ...) fails validation with a
reported error rather than the extra key being silently dropped. This is defense in
depth, not the only thing preventing it: `createTrip`/`updateTrip` in
`features/trips/actions.ts` build the object sent to Supabase field-by-field from an
explicit allowlist (`name`, `destination`, `description`, `start_date`, `end_date`) —
`parsed.data` is never spread directly into `.insert()`/`.update()`, so even a schema
change later couldn't silently widen what's writable.

### Civil dates: format-valid is not the same as calendar-valid

`lib/dates/civil-date.ts`'s `isValidCivilDate()` goes beyond the `YYYY-MM-DD` regex
(which alone would accept `2026-02-30`, `2026-13-10`, `2026-00-00`, etc.): it uses
`Date.UTC(year, month - 1, day)` purely as scratch arithmetic to detect
overflow/underflow (e.g. `Date.UTC` normalizes April 31 into May 1), then compares the
UTC year/month/day read back out to what was passed in. Only `getUTC*` accessors are
used, never the local-timezone `getMonth()`/`getDate()` variants, and the function never
returns a `Date` — the string is the value everywhere else in the app, end to end
(`tripFormSchema`, the insert/update payload, the Postgres `date` column, and back out
through `trips_with_status`). `end_date >= start_date` is a plain string comparison,
which is chronologically correct for `YYYY-MM-DD` strings without ever constructing a
`Date`. Verified round-trip with no shift:
`unit-tests/integration/trips.test.ts` writes `2026-01-01`/`2026-12-31` and reads back
the identical strings.

### Ownership and "not found" are indistinguishable, on purpose

`features/trips/queries.ts`'s `getTripById()` returns `null` for three different
underlying situations — a malformed UUID (caught by `uuidSchema` before any query is
made), a well-formed UUID that doesn't exist, and a well-formed UUID belonging to
another user (silently filtered out by `trips_select_own`'s RLS `using` clause, not an
error) — and the calling page always responds the same way: `notFound()`, rendering
`app/dashboard/not-found.tsx`, which never includes the requested id in its message.
Verified directly against the DB layer that a malformed UUID reaching PostgREST
_without_ the app's pre-validation is a `400`, not a clean empty result — which is
exactly why `queries.ts` validates before querying, rather than relying on the DB to
produce an equivalent outcome on its own.

The same "0 rows affected, same generic failure either way" rule applies to
`updateTrip`/`deleteTrip` in `features/trips/actions.ts`: a `.update()`/`.delete()`
matching zero rows (wrong id, or someone else's trip) is treated identically to any
other operational failure — same message, same log category — so neither tells a caller
which of the two happened.

### Session checks independent of `proxy.ts` / `app/dashboard/layout.tsx`

`lib/trips/auth.ts` adds a third, independent session check inside every query and every
Server Action, split by what the caller is doing rather than folded into one generic
"auth failed" path:

- `requireSupabaseForRead(pathname)` (queries, i.e. Server Components): no session is a
  navigation, not an inline error — `redirect(buildLoginRedirectUrl(pathname))`, the
  same outcome the two earlier layers would already have produced in the normal case.
  Reusing this call's own Supabase client for the actual data query avoids a second
  `getClaims()` round trip per read.
- `getSupabaseForMutation()` (Server Actions): no session is reported back to the form
  like any other actionable result (`SESSION_EXPIRED_ERROR`), never a hard redirect
  mid-submission, and deliberately **not** the same message/log category as a generic
  database failure — a routine session expiry during submission should read as exactly
  that, not as "something went wrong."

### Delete: dialog stays open on failure

`features/trips/components/delete-trip-dialog.tsx` calls `deleteTrip()` inside
`useTransition()`. Nothing in the dialog closes it on failure — `AlertDialogAction` (the
confirm button) is a plain button, not wrapped in the Base UI `Close` primitive the way
`AlertDialogCancel` is — so an error result only sets local `error` state, which renders
inside the still-open dialog as `role="alert"` (a live region, announced without a
manual `.focus()` call — the same pattern `login-form.tsx`/`signup-form.tsx` already
use). Both buttons are disabled for the duration of the transition, which is also what
prevents a duplicate submission from a second click.

### Success messages: exact known values only, param stripped after showing

`features/trips/components/trip-success-message.tsx` reads `?criado=1` / `?editado=1` /
`?excluido=1`, looks the matched key up in a fixed table of three hard-coded strings
(never reflecting the URL's actual text), renders it in `role="status"`, then removes
**only that one param** via `router.replace()` — every other param (`q`, `status`, ...)
is preserved untouched, and no full page refresh occurs. The matched key is captured
once via `useState`'s lazy initializer (evaluated during the first render) rather than
re-derived from `searchParams` on every render, specifically so the message stays
visible after the replace: a plain reactive derivation would make it disappear the
instant the URL changes. The effect itself never calls `setState` — it only performs the
`router.replace()` navigation, which is what the effect is for.

### Docker, `secure` cookies, and testing on `localhost`

The Docker image runs with `NODE_ENV=production`, so
`lib/supabase/env.ts`'s `getSupabaseCookieOptions()` sets `secure: true` there. Tested
directly against the running production container (`itrip_mvp-app-1`) accessed at
`http://localhost:3002` (the host-side port — see `docker-compose.yml`'s `3002:3000`
mapping and docs/local-environment.md; the container's own internal port is still 3000) — plain HTTP, no TLS — and confirmed by two independent sources rather than
assumed:

- W3C Secure Contexts §3.1 ("Is origin potentially trustworthy?"): `localhost` and the
  loopback ranges `127.0.0.0/8` / `::1/128` are treated as potentially trustworthy even
  without HTTPS.
- MDN's `Set-Cookie` reference, on the `Secure` attribute: _"the `https:` requirements
  are ignored when the `Secure` attribute is set by localhost."_

The exemption is host-based (`localhost`/`127.0.0.1`/`::1`), not port-based, so it holds
regardless of which port the container is published on. So a `Secure` cookie set by this
project's own production container is accepted and sent normally by every modern browser
when the app is reached via `http://localhost:3002` or `http://127.0.0.1:3002` — **this
is not weakened for local testing**; the same `secure: true` production configuration is
what's being exercised. The exemption does **not** extend to a LAN IP
(`http://192.168.x.x:3002`) or any other non-HTTPS hostname — reaching the container that
way would silently drop the session cookie and look like a broken login. Correct local
testing of the production build is: always via `localhost` or `127.0.0.1`, never a LAN
IP, and never treated as equivalent to how the app will actually be reached once deployed
behind real HTTPS.

### No pagination (documented MVP scope decision)

`search_trips` returns the caller's full, filtered result set in one call. With the
small per-user trip counts this project targets (single digits to low tens), this was a
deliberate scope decision for the MVP rather than an oversight — the same simplification
already made for other areas of this project. Revisiting it (offset/keyset pagination on
the RPC) is future work if trip counts grow.

### Itinerary field

`trips.itinerary` (added in `supabase/migrations/20260912022738_add_trips_itinerary.sql`)
is a plain, unstructured `text` column, capped at 10,000 characters by a named check
constraint (`trips_itinerary_length`). Deliberately simple for this phase — no
structured days/times/activities, no drag-and-drop, no maps, no rich text editor, no
uploads, no AI generation; all explicitly deferred, not implemented as stubs.

- **Normalization** follows exactly the same split already established for
  `description`: the DB trigger (`normalize_trips()`) only trims; turning an
  empty/whitespace-only value into `null` is an application-layer concern
  (`features/trips/schemas.ts`'s `.transform()`), not a DB-layer one. `.trim()` only
  touches the string's own leading/trailing edges — internal line breaks are untouched,
  so a multi-line itinerary round-trips exactly as typed (verified in
  `unit-tests/integration/trips.test.ts`, writing a 3-line string and reading it back
  byte-for-byte).
- **Never searched**: `search_trips` returns `itinerary` in its result rows but never
  matches against it — only `name`/`destination` are searched, per the explicit scope
  for this phase.
- **RLS**: no new policy was needed — `itinerary` is just another column on `trips`,
  governed by the same `trips_select_own`/`trips_update_own`/etc. policies as every
  other column. Verified directly (not assumed): a cross-user `trips_with_status` select
  including `itinerary` returns no row at all for another user's trip, and `search_trips`
  called by a different user for the same search term returns zero rows.
- **XSS-safe by construction, not by sanitization**: `features/trips/components/trip-itinerary.tsx`
  interpolates `itinerary` as ordinary JSX text — never `dangerouslySetInnerHTML` — so
  React's automatic escaping is what prevents anything HTML- or Markdown-looking the
  user typed from ever being parsed or executed; it is always displayed as the literal
  characters typed. `whitespace-pre-wrap` (CSS) is what preserves line breaks visually;
  no markup (`<br>`) is generated for them. Verified in
  `unit-tests/features/trips/components/trip-itinerary.test.tsx`: a `<script>`/`<img
onerror>` payload renders as visible text and creates no actual `<script>`/`<img>`
  DOM node.
- **Write path**: identical allowlist discipline as every other trip field —
  `features/trips/actions.ts`'s `createTrip`/`updateTrip` list `itinerary` explicitly in
  the object sent to `.insert()`/`.update()`; `parsed.data` is never spread directly.
  `tripFormSchema` remains `z.strictObject(...)`, so `status`/`owner_id`/any other
  unrecognized key in a payload that also includes `itinerary` is still rejected exactly
  as before — adding a field to the allowlist does not loosen what else is accepted.

### Date locale: PT-BR text, and the native date input's own limitation

Investigated after the app was seen showing a date as `09/14/2026` (US month-first
order) rather than `14/09/2026`:

- **Every date the app itself formats as text** (`lib/dates/civil-date.ts`'s
  `formatCivilDateBR()`, used by trip cards and the trip detail page) was already
  correct — confirmed by grepping the rendered HTML for `DD/MM/AAAA`-shaped strings,
  which is all it ever produces: pure string slicing on the `YYYY-MM-DD` value, no
  `Date`, no `Intl`/`toLocaleDateString()` anywhere in the codebase (grepped to confirm
  zero matches for either outside `lib/dates/civil-date.ts`'s own internal validation
  arithmetic and unrelated timestamp assertions in integration tests).
- **The actual cause**: `app/layout.tsx` declared `<html lang="en">` on a
  Portuguese-language application — a real bug, fixed to `lang="pt-BR"`. This matters
  for accessibility (screen readers use `lang` to choose pronunciation rules)
  independently of any date-formatting effect.
- **Honest limitation, not hidden**: the `09/14/2026`-shaped text the user actually saw
  is the **native** `<input type="date">` control's own rendering (in
  `features/trips/components/trip-form.tsx`) — its displayed format (though never its
  underlying `value`, which is always `YYYY-MM-DD` regardless of display) is controlled
  by the browser using the browser/OS's own locale/regional settings, not reliably by
  the page's `lang` attribute; behavior differs by browser and isn't something this
  project's code can fully guarantee. `lang="pt-BR"` is still the correct, standards-
  based signal to send and does influence some browsers, but is not a guaranteed fix for
  every browser/OS combination. Per this phase's explicit instruction, the native input
  was not replaced with a custom date picker to chase full control over this — that
  trade-off (accessibility and platform-native behavior of a real `<input type="date">`
  vs. exact cross-browser visual control) was made deliberately in favor of the native
  control.
