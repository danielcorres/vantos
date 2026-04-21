-- ============================================================
-- VANT · Hitos y countdown para asesores
-- - Agrega columnas en profiles para seguimiento de hitos
-- - Crea tabla dedicada advisor_life_policies (fuente propia,
--   desacoplada de OKR policies_paid y del pipeline leads.paid_at)
-- - Agrega RPC para conteo eficiente y RLS-safe
-- - Agrega policy para que seguimiento/developer también puedan
--   actualizar columnas no sensibles de profiles
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) Columnas nuevas en profiles (todas NULLABLE, sin backfill)
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists birth_date date null,
  add column if not exists advisor_code text null,
  add column if not exists connection_date date null,
  add column if not exists advisor_status text null,
  add column if not exists contract_signed_at timestamptz null;

-- CHECK de advisor_status (solo si el valor no es null)
do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'profiles'
      and constraint_name = 'profiles_advisor_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_advisor_status_check
      check (
        advisor_status is null
        or advisor_status in ('asesor_12_meses', 'nueva_generacion', 'consolidado')
      );
  end if;
end $$;

-- UNIQUE parcial sobre advisor_code donde no sea null
create unique index if not exists ux_profiles_advisor_code_not_null
  on public.profiles (advisor_code)
  where advisor_code is not null;

-- Índice para filtrar asesores 12 meses rápidamente
create index if not exists idx_profiles_advisor_status
  on public.profiles (advisor_status)
  where advisor_status is not null;

-- ------------------------------------------------------------
-- 2) Helper: is_milestone_editor()
--    owner | director | seguimiento | developer (si existe el rol)
-- ------------------------------------------------------------
create or replace function public.is_milestone_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_owner()
    or public.is_director()
    or public.is_seguimiento()
    or public.auth_role() = 'developer';
$$;

grant execute on function public.is_milestone_editor() to authenticated;

-- ------------------------------------------------------------
-- 3) Policy adicional en profiles: seguimiento/developer pueden
--    UPDATE. El trigger profiles_block_sensitive_updates seguirá
--    impidiendo cambios de role / manager / recruiter para
--    usuarios que no sean owner/director.
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_update_milestone_editor'
  ) then
    execute $p$
      create policy "profiles_update_milestone_editor"
      on public.profiles
      as permissive
      for update
      to authenticated
      using (public.is_milestone_editor())
      with check (public.is_milestone_editor());
    $p$;
  end if;
end $$;

-- ------------------------------------------------------------
-- 4) Tabla advisor_life_policies (fuente propia)
-- ------------------------------------------------------------
create table if not exists public.advisor_life_policies (
  id uuid primary key default gen_random_uuid(),
  advisor_user_id uuid not null references public.profiles(user_id) on delete cascade,
  paid_at date not null,
  policy_number text null,
  notes text null,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_advisor_life_policies_advisor_paid
  on public.advisor_life_policies (advisor_user_id, paid_at desc);

-- Trigger set_updated_at (la función ya existe desde migraciones previas)
do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'advisor_life_policies_set_updated_at'
      and n.nspname = 'public'
      and c.relname = 'advisor_life_policies'
  ) then
    create trigger advisor_life_policies_set_updated_at
    before update on public.advisor_life_policies
    for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.advisor_life_policies enable row level security;

-- SELECT: self, milestone editors (owner/director/seguimiento/developer)
-- y manager/recruiter del asesor.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'advisor_life_policies'
      and policyname = 'advisor_life_policies_select'
  ) then
    execute $p$
      create policy "advisor_life_policies_select"
      on public.advisor_life_policies
      as permissive
      for select
      to authenticated
      using (
        advisor_user_id = auth.uid()
        or public.is_milestone_editor()
        or exists (
          select 1 from public.profiles p
          where p.user_id = advisor_life_policies.advisor_user_id
            and (p.manager_user_id = auth.uid() or p.recruiter_user_id = auth.uid())
        )
      );
    $p$;
  end if;
end $$;

-- INSERT: solo milestone editors
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'advisor_life_policies'
      and policyname = 'advisor_life_policies_insert'
  ) then
    execute $p$
      create policy "advisor_life_policies_insert"
      on public.advisor_life_policies
      as permissive
      for insert
      to authenticated
      with check (public.is_milestone_editor());
    $p$;
  end if;
end $$;

-- UPDATE: solo milestone editors
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'advisor_life_policies'
      and policyname = 'advisor_life_policies_update'
  ) then
    execute $p$
      create policy "advisor_life_policies_update"
      on public.advisor_life_policies
      as permissive
      for update
      to authenticated
      using (public.is_milestone_editor())
      with check (public.is_milestone_editor());
    $p$;
  end if;
end $$;

-- DELETE: solo milestone editors
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'advisor_life_policies'
      and policyname = 'advisor_life_policies_delete'
  ) then
    execute $p$
      create policy "advisor_life_policies_delete"
      on public.advisor_life_policies
      as permissive
      for delete
      to authenticated
      using (public.is_milestone_editor());
    $p$;
  end if;
end $$;

-- ------------------------------------------------------------
-- 5) RPC: get_advisor_life_policy_count
--    Conteo en rango [from, to) con RLS respetada.
--    Si el llamador no tiene acceso a las filas, devolverá 0.
-- ------------------------------------------------------------
create or replace function public.get_advisor_life_policy_count(
  p_advisor uuid,
  p_from date,
  p_to date
)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint
  from public.advisor_life_policies
  where advisor_user_id = p_advisor
    and paid_at >= p_from
    and paid_at < p_to;
$$;

grant execute on function public.get_advisor_life_policy_count(uuid, date, date) to authenticated;

commit;

-- ============================================================
-- DOWN (para referencia, no se ejecuta automáticamente):
-- begin;
--   drop function if exists public.get_advisor_life_policy_count(uuid, date, date);
--   drop table if exists public.advisor_life_policies;
--   drop policy if exists "profiles_update_milestone_editor" on public.profiles;
--   drop function if exists public.is_milestone_editor();
--   alter table public.profiles
--     drop constraint if exists profiles_advisor_status_check,
--     drop column if exists contract_signed_at,
--     drop column if exists advisor_status,
--     drop column if exists connection_date,
--     drop column if exists advisor_code,
--     drop column if exists birth_date;
--   drop index if exists public.ux_profiles_advisor_code_not_null;
--   drop index if exists public.idx_profiles_advisor_status;
-- commit;
-- ============================================================
