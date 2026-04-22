-- Rollback manual de las migraciones eliminadas del repo:
--   20260422140000_profiles_seguimiento_developer_assignment_columns.sql
--   20260422160000_profiles_manager_recruiter_self_assign.sql
--
-- Idempotente: usa IF EXISTS / DROP IF EXISTS donde aplica.
-- Ejecutar en el mismo orden que supabase migration (o `supabase db push`).

begin;

-- ---------------------------------------------------------------------------
-- 1) Políticas añadidas en 20260422160000 (manager / recruiter self-assign)
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_update_manager_claimable_advisors" on public.profiles;
drop policy if exists "profiles_update_recruiter_claimable_advisors" on public.profiles;
drop policy if exists "manager_can_select_advisors_for_self_assign" on public.profiles;
drop policy if exists "recruiter_can_select_advisors_for_self_assign" on public.profiles;

-- ---------------------------------------------------------------------------
-- 2) Política y función de 20260422140000 (developer SELECT global)
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_developer_all" on public.profiles;
drop function if exists public.is_developer();

-- ---------------------------------------------------------------------------
-- 3) advisor_life_policies_select: volver a manager/recruiter solamente
--    (debe ejecutarse ANTES de dropear columnas seguimiento_user_id / developer_user_id)
-- ---------------------------------------------------------------------------
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
        and (p.manager_user_id = auth.uid() or p.recruiter_user_id = auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- 4) Trigger normalize: solo limpiar manager/recruiter al dejar de ser advisor
--    (estado previo a 20260422140000)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 5) Trigger blindaje: solo owner/director para role / manager / recruiter
--    (estado previo a 20260422140000)
-- ---------------------------------------------------------------------------
create or replace function public.profiles_block_sensitive_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
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

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 6) Quitar columnas e índices (FK primero)
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_seguimiento_user_id_fkey;
alter table public.profiles drop constraint if exists profiles_developer_user_id_fkey;

drop index if exists public.idx_profiles_seguimiento_user_id;
drop index if exists public.idx_profiles_developer_user_id;

alter table public.profiles drop column if exists seguimiento_user_id;
alter table public.profiles drop column if exists developer_user_id;

commit;
