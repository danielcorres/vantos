-- ============================================================
-- VANT · Asignaciones híbridas + self-claim (Manager / Recluta / Seguimiento)
-- - Tabla N:N advisor_seguimiento
-- - Auditoría en profiles (manager/recruiter)
-- - can_claim_advisor() + RLS para reclamar/soltar asesores
-- - Trigger: self-claim sin tocar otros campos sensibles
-- ============================================================

begin;

-- ---------------------------------------------------------------------------
-- 1) Función: líder puede reclamar slot (manager / recruiter / seguimiento)
-- ---------------------------------------------------------------------------
create or replace function public.can_claim_advisor(target_role text)
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
      and (
        (target_role = 'manager'     and p.role = 'manager')
        or (target_role = 'recruiter'   and p.role = 'recruiter')
        or (target_role = 'seguimiento' and p.role = 'seguimiento')
      )
  );
$$;

grant execute on function public.can_claim_advisor(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Auditoría en profiles (manager / recruiter)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists manager_assigned_by uuid references public.profiles(user_id) on delete set null,
  add column if not exists manager_assigned_at timestamptz,
  add column if not exists recruiter_assigned_by uuid references public.profiles(user_id) on delete set null,
  add column if not exists recruiter_assigned_at timestamptz;

-- ---------------------------------------------------------------------------
-- 3) Tabla N:N asesor ↔ seguimiento
-- ---------------------------------------------------------------------------
create table if not exists public.advisor_seguimiento (
  advisor_user_id uuid not null references public.profiles(user_id) on delete cascade,
  seguimiento_user_id uuid not null references public.profiles(user_id) on delete cascade,
  assigned_by uuid references public.profiles(user_id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (advisor_user_id, seguimiento_user_id)
);

create index if not exists idx_advisor_seguimiento_seg
  on public.advisor_seguimiento (seguimiento_user_id);

alter table public.advisor_seguimiento enable row level security;

-- ---------------------------------------------------------------------------
-- 4) RLS advisor_seguimiento
-- ---------------------------------------------------------------------------
drop policy if exists "advisor_seguimiento_select" on public.advisor_seguimiento;
create policy "advisor_seguimiento_select"
  on public.advisor_seguimiento
  as permissive
  for select
  to authenticated
  using (
    public.can_assign_roles()
    or seguimiento_user_id = auth.uid()
    or advisor_user_id = auth.uid()
  );

drop policy if exists "advisor_seguimiento_insert" on public.advisor_seguimiento;
create policy "advisor_seguimiento_insert"
  on public.advisor_seguimiento
  as permissive
  for insert
  to authenticated
  with check (
    public.can_assign_roles()
    or (
      seguimiento_user_id = auth.uid()
      and public.can_claim_advisor('seguimiento')
    )
  );

drop policy if exists "advisor_seguimiento_delete" on public.advisor_seguimiento;
create policy "advisor_seguimiento_delete"
  on public.advisor_seguimiento
  as permissive
  for delete
  to authenticated
  using (
    public.can_assign_roles()
    or seguimiento_user_id = auth.uid()
  );

-- ---------------------------------------------------------------------------
-- 5) SELECT: managers / recruiters ven asesores sin asignar (pool "Disponibles")
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_select_manager_unassigned_advisors" on public.profiles;
create policy "profiles_select_manager_unassigned_advisors"
  on public.profiles
  as permissive
  for select
  to authenticated
  using (
    role = 'advisor'
    and manager_user_id is null
    and public.can_claim_advisor('manager')
  );

drop policy if exists "profiles_select_recruiter_unassigned_advisors" on public.profiles;
create policy "profiles_select_recruiter_unassigned_advisors"
  on public.profiles
  as permissive
  for select
  to authenticated
  using (
    role = 'advisor'
    and recruiter_user_id is null
    and public.can_claim_advisor('recruiter')
  );

-- ---------------------------------------------------------------------------
-- 6) UPDATE: self-claim manager / recruiter (solo su FK en filas advisor)
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_update_manager_self_claim_advisors" on public.profiles;
create policy "profiles_update_manager_self_claim_advisors"
  on public.profiles
  as permissive
  for update
  to authenticated
  using (
    role = 'advisor'
    and public.can_claim_advisor('manager')
    and (manager_user_id is null or manager_user_id = auth.uid())
  )
  with check (
    role = 'advisor'
    and (manager_user_id is null or manager_user_id = auth.uid())
  );

drop policy if exists "profiles_update_recruiter_self_claim_advisors" on public.profiles;
create policy "profiles_update_recruiter_self_claim_advisors"
  on public.profiles
  as permissive
  for update
  to authenticated
  using (
    role = 'advisor'
    and public.can_claim_advisor('recruiter')
    and (recruiter_user_id is null or recruiter_user_id = auth.uid())
  )
  with check (
    role = 'advisor'
    and (recruiter_user_id is null or recruiter_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 7) Normalizar: al dejar de ser advisor, limpiar enlaces de seguimiento N:N
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
      delete from public.advisor_seguimiento s
      where s.advisor_user_id = new.user_id;

      new.manager_user_id := null;
      new.recruiter_user_id := null;
    end if;
  end if;
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 8) Trigger blindaje: owner/director + self-claim manager/recruiter
-- ---------------------------------------------------------------------------
create or replace function public.profiles_block_sensitive_updates()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if public.can_assign_roles() then
    if new.manager_user_id is distinct from old.manager_user_id then
      new.manager_assigned_by :=
        case when new.manager_user_id is not null then auth.uid() else null end;
      new.manager_assigned_at :=
        case when new.manager_user_id is not null then now() else null end;
    end if;

    if new.recruiter_user_id is distinct from old.recruiter_user_id then
      new.recruiter_assigned_by :=
        case when new.recruiter_user_id is not null then auth.uid() else null end;
      new.recruiter_assigned_at :=
        case when new.recruiter_user_id is not null then now() else null end;
    end if;

    return new;
  end if;

  -- Self-claim / release manager (solo toca manager_user_id)
  if public.can_claim_advisor('manager')
     and old.role = 'advisor'
     and new.role = 'advisor'
     and new.manager_user_id is distinct from old.manager_user_id
     and old.recruiter_user_id is not distinct from new.recruiter_user_id
  then
    if new.manager_user_id is not null and new.manager_user_id <> auth.uid() then
      raise exception 'Not authorized to assign manager slot to another user';
    end if;

    if new.manager_user_id is not null then
      new.manager_assigned_by := auth.uid();
      new.manager_assigned_at := now();
    else
      new.manager_assigned_by := null;
      new.manager_assigned_at := null;
    end if;

    return new;
  end if;

  -- Self-claim / release recruiter
  if public.can_claim_advisor('recruiter')
     and old.role = 'advisor'
     and new.role = 'advisor'
     and new.recruiter_user_id is distinct from old.recruiter_user_id
     and old.manager_user_id is not distinct from new.manager_user_id
  then
    if new.recruiter_user_id is not null and new.recruiter_user_id <> auth.uid() then
      raise exception 'Not authorized to assign recruiter slot to another user';
    end if;

    if new.recruiter_user_id is not null then
      new.recruiter_assigned_by := auth.uid();
      new.recruiter_assigned_at := now();
    else
      new.recruiter_assigned_by := null;
      new.recruiter_assigned_at := null;
    end if;

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
-- 9) Auditoría en inserts advisor_seguimiento (self vs directivo)
-- ---------------------------------------------------------------------------
create or replace function public.advisor_seguimiento_set_assigned_by()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.assigned_by is null then
    if public.can_assign_roles() then
      new.assigned_by := auth.uid();
    elsif new.seguimiento_user_id = auth.uid() then
      new.assigned_by := auth.uid();
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_advisor_seguimiento_1_validate on public.advisor_seguimiento;
drop trigger if exists trg_advisor_seguimiento_2_set_assigned_by on public.advisor_seguimiento;
drop trigger if exists trg_advisor_seguimiento_set_assigned_by on public.advisor_seguimiento;
drop trigger if exists trg_advisor_seguimiento_validate on public.advisor_seguimiento;

-- ---------------------------------------------------------------------------
-- 10) Validar roles en advisor_seguimiento (antes de rellenar assigned_by)
-- ---------------------------------------------------------------------------
create or replace function public.advisor_seguimiento_validate()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not exists (
    select 1 from public.profiles p
    where p.user_id = new.advisor_user_id
      and p.role = 'advisor'
  ) then
    raise exception 'advisor_seguimiento: advisor_user_id must be an advisor profile';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.user_id = new.seguimiento_user_id
      and p.role = 'seguimiento'
  ) then
    raise exception 'advisor_seguimiento: seguimiento_user_id must be a seguimiento profile';
  end if;

  return new;
end;
$function$;

create trigger trg_advisor_seguimiento_1_validate
  before insert on public.advisor_seguimiento
  for each row
  execute function public.advisor_seguimiento_validate();

create trigger trg_advisor_seguimiento_2_set_assigned_by
  before insert on public.advisor_seguimiento
  for each row
  execute function public.advisor_seguimiento_set_assigned_by();

grant select, insert, delete on public.advisor_seguimiento to authenticated;

commit;
