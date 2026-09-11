-- profiles: one row per auth.users row, holding the display name.
--
-- Security notes:
-- * set_updated_at() and normalize_profiles() are trigger-only helpers: EXECUTE is
--   revoked from PUBLIC so no client role can call them directly via RPC. Triggers do
--   not require the invoking role to hold EXECUTE on the trigger function, so this does
--   not affect their normal operation.
-- * handle_new_user() is SECURITY DEFINER (it must write to public.profiles regardless
--   of who is signing up) and therefore uses `set search_path = ''` with fully-qualified
--   references everywhere, so it cannot be tricked by a same-named object placed earlier
--   in some other search_path. EXECUTE is revoked from PUBLIC — it only ever runs via the
--   trigger on auth.users, never as a direct client call.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_updated_at() from public;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_name_not_blank check (char_length(name) between 1 and 120)
);

comment on table public.profiles is
  'One row per auth.users row. Created automatically by handle_new_user(); never by the app directly.';

-- Stores name already trimmed, so profiles_name_not_blank validates the final,
-- normalized value (BEFORE-trigger changes to NEW are visible to constraint checks).
create or replace function public.normalize_profiles()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name = btrim(new.name);
  return new;
end;
$$;

revoke execute on function public.normalize_profiles() from public;

create trigger normalize_profiles_before_write
  before insert or update on public.profiles
  for each row execute function public.normalize_profiles();

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());

create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

revoke all on public.profiles from anon;
revoke all on public.profiles from public;
grant select, update on public.profiles to authenticated;

-- Profile creation trigger. Validates the incoming name explicitly (rather than relying
-- only on the table constraint) so every rejected case produces one clear error, and a
-- rejected insert here aborts the whole auth.users insert in the same transaction — no
-- user is left without a profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  v_name := btrim(new.raw_user_meta_data ->> 'name');

  if v_name is null or char_length(v_name) = 0 then
    raise exception 'profiles.name is required and cannot be blank'
      using errcode = '23514';
  end if;

  if char_length(v_name) > 120 then
    raise exception 'profiles.name must be at most 120 characters'
      using errcode = '23514';
  end if;

  insert into public.profiles (id, name) values (new.id, v_name);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
