-- Adds an optional free-text itinerary to trips. Deliberately simple for this phase —
-- no structured days/times/activities, no rich text, no attachments; see docs/security.md
-- for the explicit list of what is intentionally deferred to a later phase.
alter table public.trips
  add column itinerary text;

alter table public.trips
  add constraint trips_itinerary_length check (char_length(itinerary) <= 10000);

-- Extends the existing normalize_trips() trigger (from
-- 20260911191157_create_trips.sql) to also trim itinerary. Mirrors description's
-- treatment exactly: the trigger only trims, it does not turn an empty/whitespace-only
-- string into null — that normalization is an application-layer concern
-- (features/trips/schemas.ts), consistent with how description already works.
create or replace function public.normalize_trips()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name = btrim(new.name);
  new.destination = btrim(new.destination);
  if new.description is not null then
    new.description = btrim(new.description);
  end if;
  if new.itinerary is not null then
    new.itinerary = btrim(new.itinerary);
  end if;
  return new;
end;
$$;

-- CREATE OR REPLACE VIEW only allows *appending* columns at the end of the output list
-- (existing column names/order/types must stay identical) — so itinerary is added last
-- here, even though it's conceptually grouped with description. Callers select by name,
-- never by position, so this has no effect on any query.
create or replace view public.trips_with_status
with (security_invoker = true) as
select
  id,
  owner_id,
  name,
  destination,
  start_date,
  end_date,
  description,
  public.compute_trip_status(start_date, end_date) as status,
  created_at,
  updated_at,
  itinerary
from public.trips;

-- search_trips's return type is changing (new output column). Unlike a view,
-- CREATE OR REPLACE FUNCTION cannot change a function's RETURNS TABLE column list —
-- Postgres requires dropping and recreating it. Grants do not survive a drop, so they
-- are re-applied below (identical to 20260911212923_create_search_trips_function.sql).
drop function if exists public.search_trips(text, public.trip_status);

create function public.search_trips(
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
  updated_at timestamptz,
  itinerary text
)
language sql
security invoker
stable
set search_path = ''
as $$
  with params as (
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
      t.updated_at,
      t.itinerary
    from public.trips t, params
    where
      params.pattern is null
      or t.name ilike params.pattern escape '\'
      or t.destination ilike params.pattern escape '\'
  )
  select
    id, name, destination, start_date, end_date, description, status, created_at,
    updated_at, itinerary
  from scoped
  where p_status is null or status = p_status
  order by
    case status
      when 'ongoing' then 0
      when 'upcoming' then 1
      when 'planning' then 2
      when 'completed' then 3
    end,
    case when status <> 'completed' then start_date end asc,
    case when status = 'completed' then start_date end desc;
$$;

comment on function public.search_trips(text, public.trip_status) is
  'List-page query for trips: search (name/destination, literal % and _), optional status
   filter, and the fixed ongoing/upcoming/planning/completed group ordering. Also returns
   itinerary (not part of the search itself). No pagination (out of scope for this MVP —
   see docs). Client cannot choose owner_id, an arbitrary sort expression, or bypass RLS:
   this always runs as the calling role via SECURITY INVOKER.';

revoke execute on function public.search_trips(text, public.trip_status) from public;
revoke execute on function public.search_trips(text, public.trip_status) from anon;
grant execute on function public.search_trips(text, public.trip_status) to authenticated;
