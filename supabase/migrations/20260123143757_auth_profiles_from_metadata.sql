-- ============================================================================
-- Migration: auth_profiles_from_metadata
-- Purpose:
--   - Copy first_name / last_name from auth.users.raw_user_meta_data into public.profiles
--   - Ensure new signups automatically populate profiles via trigger
-- Notes:
--   - Idempotent: safe to run multiple times (create or replace + drop trigger if exists)
--   - Assumes public.profiles has a UNIQUE or PRIMARY KEY on (user_id)
--     If your profiles PK is (id) instead, replace user_id -> id in 3 places (marked below).
-- ============================================================================

begin;

-- 1) Trigger function: create / update profile from auth.users metadata
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, first_name, last_name)  -- <-- if PK is profiles.id, change user_id -> id
  values (
    NEW.id,
    nullif(NEW.raw_user_meta_data->>'first_name', ''),
    nullif(NEW.raw_user_meta_data->>'last_name', '')
  )
  on conflict (user_id) do update                               -- <-- if PK is profiles.id, change user_id -> id
  set
    first_name = coalesce(excluded.first_name, public.profiles.first_name),
    last_name  = coalesce(excluded.last_name,  public.profiles.last_name);

  return NEW;
end;
$$;

-- 2) Trigger: run after a new auth user is created
drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute procedure public.handle_new_user_profile();

-- 3) (Optional but recommended) Backfill existing profiles that are empty
-- This helps users you already created before the change.
update public.profiles p
set
  first_name = coalesce(p.first_name, nullif(u.raw_user_meta_data->>'first_name','')),
  last_name  = coalesce(p.last_name,  nullif(u.raw_user_meta_data->>'last_name',''))
from auth.users u
where u.id = p.user_id                                          -- <-- if PK is profiles.id, change p.user_id -> p.id
  and (
    p.first_name is null or p.first_name = '' or
    p.last_name  is null or p.last_name  = ''
  );

commit;
