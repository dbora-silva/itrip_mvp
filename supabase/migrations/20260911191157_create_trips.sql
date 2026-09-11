-- Pin the database's effective timezone to UTC explicitly, rather than relying on the
-- container's default. compute_trip_status() below does not depend on this (it computes
-- "today" from now() AT TIME ZONE 'utc' regardless of the session's TimeZone setting), but
-- pinning it here is defense in depth for any other code that uses bare now()/current_date.
alter database postgres set timezone to 'utc';

create type public.trip_status as enum ('planning', 'upcoming', 'ongoing', 'completed');

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  destination text not null,
  start_date date not null,
  end_date date not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trips_name_not_blank check (char_length(name) between 1 and 120),
  constraint trips_destination_not_blank check (char_length(destination) between 1 and 120),
  constraint trips_description_length check (char_length(description) <= 2000),
  constraint trips_end_date_after_start_date check (end_date >= start_date)
);

comment on table public.trips is
  'No status column: status is derived at read time by compute_trip_status() via the
   trips_with_status view, so it can never go stale between the dates it is computed from.';

create index trips_owner_id_idx on public.trips (owner_id);

-- Trims name/destination (and description, when present) so the *_not_blank checks above
-- validate the final, normalized value. Plain btrim(): no Unicode normalization beyond
-- what btrim already does — kept deliberately simple for this phase.
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
  return new;
end;
$$;

revoke execute on function public.normalize_trips() from public;

create trigger normalize_trips_before_write
  before insert or update on public.trips
  for each row execute function public.normalize_trips();

create trigger set_trips_updated_at
  before update on public.trips
  for each row execute function public.set_updated_at();

alter table public.trips enable row level security;

create policy trips_select_own on public.trips
  for select using (owner_id = auth.uid());

create policy trips_insert_own on public.trips
  for insert with check (owner_id = auth.uid());

create policy trips_update_own on public.trips
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy trips_delete_own on public.trips
  for delete using (owner_id = auth.uid());

revoke all on public.trips from anon;
revoke all on public.trips from public;
grant select, insert, update, delete on public.trips to authenticated;

-- Status calculation, isolated in one place so no other layer re-implements the rule.
-- Parameters are prefixed (p_...) so they can never be confused with a column of the
-- same name at any call site. NULL in, NULL out: this is a plain computation over its
-- two arguments, not a statement about whether a trip's dates may be null (they may not
-- — see trips.start_date / trips.end_date, both NOT NULL).
create or replace function public.compute_trip_status(p_start_date date, p_end_date date)
returns public.trip_status
language sql
stable
as $$
  select case
    when p_start_date is null or p_end_date is null then null
    when p_end_date < (now() at time zone 'utc')::date then 'completed'::public.trip_status
    when p_start_date <= (now() at time zone 'utc')::date
      and p_end_date >= (now() at time zone 'utc')::date then 'ongoing'::public.trip_status
    when p_start_date > (now() at time zone 'utc')::date
      and p_start_date <= (now() at time zone 'utc')::date + 30 then 'upcoming'::public.trip_status
    else 'planning'::public.trip_status
  end;
$$;

-- Pure computation, no table access: safe to expose broadly. Still explicit about grants
-- rather than relying on the default PUBLIC execute grant new functions get.
revoke execute on function public.compute_trip_status(date, date) from public;
grant execute on function public.compute_trip_status(date, date) to anon, authenticated;

-- Read-only view: the only place `status` is ever exposed. security_invoker = true (needs
-- PostgreSQL 15+; confirmed on the PostgreSQL 17.6 image this project pins) makes the view
-- run with the *querying* user's own permissions, so trips' own RLS policies above are what
-- actually govern which rows come back here — the view itself grants no extra visibility.
create view public.trips_with_status
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
  updated_at
from public.trips;

revoke all on public.trips_with_status from anon;
revoke all on public.trips_with_status from public;
grant select on public.trips_with_status to authenticated;
