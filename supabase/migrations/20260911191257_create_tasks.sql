create type public.task_status as enum ('pending', 'completed');

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  title text not null,
  description text,
  status public.task_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_title_not_blank check (char_length(title) between 1 and 200),
  constraint tasks_description_length check (char_length(description) <= 2000)
);

create index tasks_trip_id_idx on public.tasks (trip_id);

create or replace function public.normalize_tasks()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.title = btrim(new.title);
  if new.description is not null then
    new.description = btrim(new.description);
  end if;
  return new;
end;
$$;

revoke execute on function public.normalize_tasks() from public;

create trigger normalize_tasks_before_write
  before insert or update on public.tasks
  for each row execute function public.normalize_tasks();

create trigger set_tasks_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

alter table public.tasks enable row level security;

-- select/insert/delete only need the CURRENT row's trip to belong to the caller.
create policy tasks_select_own_trip on public.tasks
  for select using (
    exists (
      select 1 from public.trips
      where trips.id = tasks.trip_id and trips.owner_id = auth.uid()
    )
  );

create policy tasks_insert_own_trip on public.tasks
  for insert with check (
    exists (
      select 1 from public.trips
      where trips.id = tasks.trip_id and trips.owner_id = auth.uid()
    )
  );

-- update needs both: `using` guards the row being modified (its *current* trip must be
-- the caller's), and `with check` guards the row being written (its *new* trip_id must
-- also be the caller's) — this is what stops a user from re-pointing their own task at
-- someone else's trip. Without `with check` here, only the starting state would be
-- validated and the trip_id could be changed to any value.
create policy tasks_update_own_trip on public.tasks
  for update using (
    exists (
      select 1 from public.trips
      where trips.id = tasks.trip_id and trips.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.trips
      where trips.id = tasks.trip_id and trips.owner_id = auth.uid()
    )
  );

create policy tasks_delete_own_trip on public.tasks
  for delete using (
    exists (
      select 1 from public.trips
      where trips.id = tasks.trip_id and trips.owner_id = auth.uid()
    )
  );

revoke all on public.tasks from anon;
revoke all on public.tasks from public;
grant select, insert, update, delete on public.tasks to authenticated;
