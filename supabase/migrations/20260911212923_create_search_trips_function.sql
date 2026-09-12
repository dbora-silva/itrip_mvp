-- Centralizes list-page search, status filtering and sorting for trips in a single
-- SECURITY INVOKER function, instead of building a hand-rolled PostgREST `.or()` filter
-- string in application code. Rationale (see docs/security.md, Phase 6 section):
--   * postgrest-js's `.or()` performs no escaping of its own — the filter string is used
--     as-is (confirmed by reading node_modules/@supabase/postgrest-js/src/PostgrestFilterBuilder.ts,
--     `or()` method) — so a user-typed comma/parenthesis could break the intended filter
--     shape. Not a data-exposure risk (RLS still applies underneath either way), but a
--     correctness/robustness one.
--   * PostgREST's own docs describe no complete, official escaping recipe for arbitrary
--     text inside `or=`, only for individual reserved characters in *values* elsewhere.
--   * A SQL parameter is never subject to any of this: p_search stays a normal bound
--     parameter throughout, never string-concatenated into a query.
--
-- SECURITY INVOKER (the default for `language sql` functions, but declared explicitly):
-- the function runs with the *calling* role's own permissions, so `trips`' existing RLS
-- policies (trips_select_own) are exactly what govern which rows this can ever return —
-- the function grants no visibility beyond what a plain `select * from public.trips`
-- already would for that same caller.
create or replace function public.search_trips(
  p_search text default null,
  p_status public.trip_status default null
)
returns table (
  id uuid,
  name text,
  destination text,
  start_date date,
  end_date date,
  description text,
  status public.trip_status,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security invoker
stable
set search_path = ''
as $$
  with params as (
    -- p_search is escaped and wrapped into a LIKE pattern exactly once here, then reused
    -- for both columns below — not recomputed, and never re-concatenated per row.
    -- `%` and `_` are escaped so they are matched literally: this is user-typed search
    -- text, not a pattern the user intends to author.
    select case
      when p_search is null or length(btrim(p_search)) = 0 then null
      else '%' || replace(replace(replace(
             left(btrim(p_search), 200),
             '\', '\\'),
             '%', '\%'),
             '_', '\_'
           ) || '%'
    end as pattern
  ),
  scoped as (
    select
      t.id,
      t.name,
      t.destination,
      t.start_date,
      t.end_date,
      t.description,
      public.compute_trip_status(t.start_date, t.end_date) as status,
      t.created_at,
      t.updated_at
    from public.trips t, params
    where
      params.pattern is null
      or t.name ilike params.pattern escape '\'
      or t.destination ilike params.pattern escape '\'
  )
  select id, name, destination, start_date, end_date, description, status, created_at, updated_at
  from scoped
  where p_status is null or status = p_status
  order by
    case status
      when 'ongoing' then 0
      when 'upcoming' then 1
      when 'planning' then 2
      when 'completed' then 3
    end,
    -- Only one of the next two expressions is non-null for any given row (they are
    -- mutually exclusive on `status = 'completed'`), so together they sort each status
    -- group by its own rule without affecting the others: ascending start_date for
    -- everything except completed, descending start_date (most recently finished first)
    -- for completed.
    case when status <> 'completed' then start_date end asc,
    case when status = 'completed' then start_date end desc;
$$;

comment on function public.search_trips(text, public.trip_status) is
  'List-page query for trips: search (name/destination, literal % and _), optional status
   filter, and the fixed ongoing/upcoming/planning/completed group ordering. No pagination
   (out of scope for this MVP — see docs). Client cannot choose owner_id, an arbitrary sort
   expression, or bypass RLS: this always runs as the calling role via SECURITY INVOKER.';

revoke execute on function public.search_trips(text, public.trip_status) from public;
revoke execute on function public.search_trips(text, public.trip_status) from anon;
grant execute on function public.search_trips(text, public.trip_status) to authenticated;
