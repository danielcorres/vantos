-- ============================================================
-- VANT · HARDENING DE ROLES Y RLS
-- Objetivo:
-- 1) Eliminar dependencia de jwt()
-- 2) Evitar recursión infinita en policies
-- 3) Blindar cambios de role / manager / recruiter
-- ============================================================

-- ------------------------------------------------------------
-- 1) auth_role(): obtiene el rol real desde profiles
--    Bypassea RLS para evitar recursión
-- ------------------------------------------------------------
create or replace function public.auth_role()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r text;
begin
  -- Desactiva RLS SOLO dentro de esta función
  perform set_config('row_security', 'off', true);

  select p.role
    into r
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1;

  -- Fallback seguro
  return coalesce(r, 'advisor');
end;
$$;

grant execute on function public.auth_role() to authenticated;

-- ------------------------------------------------------------
-- 2) current_user_role(): alias de compatibilidad
-- ------------------------------------------------------------
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_role()
$$;

grant execute on function public.current_user_role() to authenticated;

-- ------------------------------------------------------------
-- 3) Helpers de rol (YA SIN JWT)
-- ------------------------------------------------------------
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_role() = 'owner'
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_role() = 'manager'
$$;

create or replace function public.is_recruiter()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_role() = 'recruiter'
$$;

create or replace function public.is_admin_or_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_role() in ('admin','owner')
$$;

grant execute on function public.is_owner() to authenticated;
grant execute on function public.is_manager() to authenticated;
grant execute on function public.is_recruiter() to authenticated;
grant execute on function public.is_admin_or_owner() to authenticated;

-- ------------------------------------------------------------
-- 4) Trigger de blindaje en profiles
--    Nadie puede cambiar:
--    - role
--    - manager_user_id
--    - recruiter_user_id
--    excepto admin / owner
-- ------------------------------------------------------------
create or replace function public.profiles_block_sensitive_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Owner / Admin sí pueden
  if public.is_admin_or_owner() then
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
$$;

drop trigger if exists trg_profiles_block_sensitive_updates on public.profiles;

create trigger trg_profiles_block_sensitive_updates
before update on public.profiles
for each row
execute function public.profiles_block_sensitive_updates();

-- ------------------------------------------------------------
-- FIN MIGRACIÓN
-- ============================================================
