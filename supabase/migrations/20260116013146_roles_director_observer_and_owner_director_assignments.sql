begin;

-- 1) director check
create or replace function public.is_director()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'director'
  );
$$;

-- 2) can_assign_roles = owner OR director
-- (is_owner() ya existe en tu esquema por okr_settings_global)
create or replace function public.can_assign_roles()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_owner() or public.is_director();
$$;

-- 3) Allow director in sensitive updates trigger
create or replace function public.profiles_block_sensitive_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  -- Owner/Director sí pueden
  if public.can_assign_roles() then
    return new;
  end if;

  -- Bloquear cambios sensibles
  if new.role is distinct from old.role
     or new.manager_user_id is distinct from old.manager_user_id
     or new.recruiter_user_id is distinct from old.recruiter_user_id
  then
    raise exception 'Not authorized to change role / manager / recruiter';
  end if;

  return new;
end;
$function$;

-- 4) RLS policy: owner/director can UPDATE any profile (needed for Asignaciones)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='profiles'
      and policyname='profiles_update_owner_director_all'
  ) then
    execute $p$
      create policy "profiles_update_owner_director_all"
      on public.profiles
      as permissive
      for update
      to authenticated
      using (public.can_assign_roles())
      with check (public.can_assign_roles());
    $p$;
  end if;
end $$;

-- 5) RLS policy: director can SELECT all profiles (so they "see everything" like you described)
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname='public'
      and tablename='profiles'
      and policyname='profiles_select_director_all'
  ) then
    execute $p$
      create policy "profiles_select_director_all"
      on public.profiles
      as permissive
      for select
      to authenticated
      using (public.is_director());
    $p$;
  end if;
end $$;

-- 6) Optional: normalize assignments when role != advisor (avoid dirty states)
create or replace function public.profiles_normalize_assignments()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.role is distinct from old.role then
    if new.role <> 'advisor' then
      new.manager_user_id := null;
      new.recruiter_user_id := null;
    end if;
  end if;
  return new;
end;
$function$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'trg_profiles_normalize_assignments'
      and n.nspname='public'
      and c.relname='profiles'
  ) then
    create trigger trg_profiles_normalize_assignments
    before update on public.profiles
    for each row
    execute function public.profiles_normalize_assignments();
  end if;
end $$;

commit;
