-- Columnas de asignación seguimiento/developer por asesor + trigger de normalización
-- y extensión de profiles_block_sensitive_updates para self-service acotado.

begin;

-- 1) Columnas (FK a profiles; al borrar perfil asignado, limpiar referencia)
alter table public.profiles
  add column if not exists seguimiento_user_id uuid null,
  add column if not exists developer_user_id uuid null;

alter table public.profiles
  drop constraint if exists profiles_seguimiento_user_id_fkey;

alter table public.profiles
  add constraint profiles_seguimiento_user_id_fkey
  foreign key (seguimiento_user_id)
  references public.profiles (user_id)
  on delete set null;

alter table public.profiles
  drop constraint if exists profiles_developer_user_id_fkey;

alter table public.profiles
  add constraint profiles_developer_user_id_fkey
  foreign key (developer_user_id)
  references public.profiles (user_id)
  on delete set null;

create index if not exists idx_profiles_seguimiento_user_id
  on public.profiles (seguimiento_user_id)
  where seguimiento_user_id is not null;

create index if not exists idx_profiles_developer_user_id
  on public.profiles (developer_user_id)
  where developer_user_id is not null;

-- 2) Normalizar: al dejar de ser advisor, limpiar todas las asignaciones de equipo
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
      new.seguimiento_user_id := null;
      new.developer_user_id := null;
    end if;
  end if;
  return new;
end;
$function$;

-- 3) Trigger de blindaje: owner/director todo; seguimiento/developer solo su slot en filas advisor
create or replace function public.profiles_block_sensitive_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  r text := public.auth_role();
begin
  if public.can_assign_roles() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.manager_user_id is distinct from old.manager_user_id
     or new.recruiter_user_id is distinct from old.recruiter_user_id
  then
    raise exception 'Not authorized to change role / manager / recruiter';
  end if;

  if new.seguimiento_user_id is distinct from old.seguimiento_user_id then
    if old.role <> 'advisor' then
      raise exception 'Not authorized to change seguimiento assignment';
    end if;
    if r = 'seguimiento' then
      if new.seguimiento_user_id is not null and new.seguimiento_user_id <> auth.uid() then
        raise exception 'Seguimiento solo puede asignarse a sí mismo en esta columna';
      end if;
      if new.seguimiento_user_id is not null
         and old.seguimiento_user_id is not null
         and old.seguimiento_user_id is distinct from auth.uid()
      then
        raise exception 'Ya hay otra persona de seguimiento asignada; solo un administrador puede reasignar';
      end if;
      if new.seguimiento_user_id is null
         and old.seguimiento_user_id is not null
         and old.seguimiento_user_id is distinct from auth.uid()
      then
        raise exception 'Seguimiento solo puede quitar su propia asignación';
      end if;
    else
      raise exception 'Not authorized to change seguimiento assignment';
    end if;
  end if;

  if new.developer_user_id is distinct from old.developer_user_id then
    if old.role <> 'advisor' then
      raise exception 'Not authorized to change developer assignment';
    end if;
    if r = 'developer' then
      if new.developer_user_id is not null and new.developer_user_id <> auth.uid() then
        raise exception 'Developer solo puede asignarse a sí mismo en esta columna';
      end if;
      if new.developer_user_id is not null
         and old.developer_user_id is not null
         and old.developer_user_id is distinct from auth.uid()
      then
        raise exception 'Ya hay otra persona asignada como developer; solo un administrador puede reasignar';
      end if;
      if new.developer_user_id is null
         and old.developer_user_id is not null
         and old.developer_user_id is distinct from auth.uid()
      then
        raise exception 'Developer solo puede quitar su propia asignación';
      end if;
    else
      raise exception 'Not authorized to change developer assignment';
    end if;
  end if;

  return new;
end;
$function$;

-- 4) advisor_life_policies: lectura si el usuario es seguimiento/developer asignado al asesor
drop policy if exists "advisor_life_policies_select" on public.advisor_life_policies;

create policy "advisor_life_policies_select"
  on public.advisor_life_policies
  as permissive
  for select
  to authenticated
  using (
    advisor_user_id = auth.uid()
    or public.is_milestone_editor()
    or exists (
      select 1
      from public.profiles p
      where p.user_id = advisor_life_policies.advisor_user_id
        and (
          p.manager_user_id = auth.uid()
          or p.recruiter_user_id = auth.uid()
          or p.seguimiento_user_id = auth.uid()
          or p.developer_user_id = auth.uid()
        )
    )
  );

-- 5) Developer: SELECT todos los profiles (necesario para la página de Asignaciones; mismo criterio que seguimiento)
create or replace function public.is_developer()
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
      and p.role = 'developer'
  );
$$;

grant execute on function public.is_developer() to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_select_developer_all'
  ) then
    execute $p$
      create policy "profiles_select_developer_all"
      on public.profiles
      as permissive
      for select
      to authenticated
      using (public.is_developer());
    $p$;
  end if;
end $$;

commit;
