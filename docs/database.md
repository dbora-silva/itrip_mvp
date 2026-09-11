# Database

## Entities and relationships

```
auth.users (Supabase Auth)
   │ 1:1 (id shared, cascade)
   ▼
profiles ──── name
   │
   │ owner_id, 1:N, cascade
   ▼
trips ──── name, destination, start_date, end_date, description?
   │
   │ trip_id, 1:N, cascade
   ▼
tasks ──── title, description?, status (pending | completed)
```

`profiles.id` is the same UUID as `auth.users.id` — not a separate identity. A row is
created automatically by the `handle_new_user()` trigger on `auth.users` insert; the
application never inserts into `profiles` directly.

`trips` has **no `status` column**. Status (`planning` / `upcoming` / `ongoing` /
`completed`) is derived at read time from `start_date`/`end_date` by
`compute_trip_status()`, exposed through the `trips_with_status` view. See
[Status calculation](#status-calculation) below for why.

`tasks.trip_id` has no separate `owner_id` — authorization is derived by joining to
`trips.owner_id` (see `docs/security.md`). This avoids duplicating ownership data that
could drift from the source of truth.

## Migrations

| File                                 | Creates                                                                             |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| `20260911191057_create_profiles.sql` | `profiles`, `set_updated_at()`, `handle_new_user()` + trigger, RLS                  |
| `20260911191157_create_trips.sql`    | `trips`, `trip_status` enum, `compute_trip_status()`, `trips_with_status` view, RLS |
| `20260911191257_create_tasks.sql`    | `tasks`, `task_status` enum, RLS                                                    |

Applied in filename order by `supabase db reset` / `supabase start`, both locally and
against a hosted project (`supabase db push`). Nothing in them depends on a manual step.

## Constraints and limits

| Field               | Rule                             |
| ------------------- | -------------------------------- |
| `profiles.name`     | required, 1–120 chars after trim |
| `trips.name`        | required, 1–120 chars after trim |
| `trips.destination` | required, 1–120 chars after trim |
| `trips.description` | optional, ≤2000 chars            |
| `trips.end_date`    | must be `>= start_date`          |
| `tasks.title`       | required, 1–200 chars after trim |
| `tasks.description` | optional, ≤2000 chars            |

`name` / `destination` / `title` are trimmed by a `BEFORE INSERT OR UPDATE` trigger
(`normalize_profiles` / `normalize_trips` / `normalize_tasks`) before the length check
runs, so a value that is only whitespace is correctly rejected as blank (`char_length` of
the trimmed value is 0) rather than silently stored as spaces. Values are stored already
trimmed — the client-side Zod schema (a later phase) should apply the same `.trim()` so
what the user sees matches what is stored. No Unicode normalization (NFC/casefolding) is
applied — plain `btrim()` only, deliberately, to keep this phase simple.

## Status calculation

```
completed: end_date < today
ongoing:   start_date <= today <= end_date
upcoming:  today < start_date <= today + 30
planning:  start_date > today + 30
```

Status is **never stored**. If it were a plain column, it would go stale on its own —
a trip that is "upcoming" today silently becomes "ongoing" tomorrow with no write to
trigger an update. `compute_trip_status(p_start_date, p_end_date)` computes it from
`(now() at time zone 'utc')::date` on every read (confirmed against the local Postgres
17.6 instance, which itself runs with `timezone = UTC`; the function does not rely on
that database setting being correct, since it converts explicitly). It is exposed to the
app exclusively through the `trips_with_status` view — nothing else recomputes this rule.

## Seeding

`supabase/seed.sql` is intentionally empty: `auth.users` cannot be seeded reliably with
plain SQL (see `docs/security.md#seed-script`), so domain data has to be created after
real user accounts exist. `npm run db:reset` runs `supabase db reset` (migrations only)
and then `npm run db:seed:users` (creates/reconciles the two fixed local test users and
their trips/tasks). See `TESTABILITY.md` (a later phase) for the full seed data
reference; the essential contract for anything built on top of it: after any number of
resets or re-seeds, there are always exactly 2 users, 4 trips each, spanning all 4 status
categories, with a mix of trips with/without tasks and tasks pending/completed. Exact
UUIDs and exact dates are not stable across resets — only that shape is.
