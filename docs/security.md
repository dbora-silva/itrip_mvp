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
(`node_modules/@supabase/auth-js/dist/module/GoTrueClient.js`, `getClaims()` JSDoc and
implementation) and from a direct test against the local instance:

- **If the project signs JWTs with an asymmetric key** (ES256/RS256), `getClaims()`
  verifies the signature locally against a cached JWKS (`/.well-known/jwks.json`,
  fetched once and cached in-process) — no per-request network call once cached.
- **If the project signs JWTs with the legacy symmetric secret (HS256)** — which is
  what this project's local `supabase/config.toml` currently uses (`JWT_SECRET`, printed
  by `supabase status`) — the installed source states plainly: _"it always sends a
  request similar to `getUser()` to validate the JWT at the server."_ This was
  confirmed empirically too: two consecutive `getClaims()` calls against the local
  instance took 11ms and 1ms respectively — consistent with a fast local-network call,
  not proof of offline verification, and the symmetric-signing code path in the
  installed source shows there is no local-verification branch available for HS256 at
  all.
- If the access token is close to expiring when `getClaims()` is called, the session is
  refreshed first (another network round trip) before the JWT is validated.

**Consequence documented, not hidden:** with this project's current local (HS256)
configuration, every `proxy.ts` invocation and every `app/dashboard/layout.tsx` render
makes a real network call to the Auth server — there is no offline fast path today. If a
hosted project is later configured with asymmetric signing keys, this becomes faster
automatically (same code, no change needed) — but that has not been verified against a
hosted project and is not claimed as current behavior.

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
