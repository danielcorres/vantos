-- ============================================================
-- OKR: Mínimos semanales por asesor (configurables por owner)
-- ============================================================

-- Tabla para almacenar mínimos semanales por métrica y rol
create table if not exists public.okr_weekly_minimum_targets (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'advisor',
  metric_key text not null,
  target_units integer not null check (target_units >= 0),
  effective_from date not null default (now() at time zone 'America/Monterrey')::date,
  effective_to date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices
create index if not exists idx_okr_weekly_minimum_targets_owner_role
  on public.okr_weekly_minimum_targets(owner_user_id, role);

-- Unique parcial para evitar duplicados activos por métrica
-- (solo una configuración activa por owner/role/metric_key a la vez)
create unique index if not exists idx_okr_weekly_minimum_targets_unique_active
  on public.okr_weekly_minimum_targets(owner_user_id, role, metric_key, effective_from)
  where effective_to is null;

-- Trigger para updated_at
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_okr_weekly_minimum_targets_updated_at') then
    create trigger trg_okr_weekly_minimum_targets_updated_at
    before update on public.okr_weekly_minimum_targets
    for each row execute function public.set_updated_at();
  end if;
end $$;

-- Habilitar RLS
alter table public.okr_weekly_minimum_targets enable row level security;

-- Políticas SELECT: owner/admin/manager pueden ver filas del mismo owner_user_id
drop policy if exists okr_weekly_minimum_targets_select on public.okr_weekly_minimum_targets;
create policy okr_weekly_minimum_targets_select
on public.okr_weekly_minimum_targets
for select
to authenticated
using (
  -- Owner puede ver sus propias configuraciones
  (owner_user_id = auth.uid() and public.is_owner())
  -- Admin puede ver todas
  or public.is_admin_or_owner()
  -- Manager puede ver configuraciones del owner de su equipo
  or (
    public.is_manager()
    and owner_user_id = (
      select owner_user_id 
      from public.okr_settings_global 
      order by created_at asc 
      limit 1
    )
  )
);

-- Políticas WRITE: solo owner/admin pueden insertar/actualizar/eliminar
drop policy if exists okr_weekly_minimum_targets_insert on public.okr_weekly_minimum_targets;
create policy okr_weekly_minimum_targets_insert
on public.okr_weekly_minimum_targets
for insert
to authenticated
with check (
  public.is_admin_or_owner()
  and owner_user_id = auth.uid()
);

drop policy if exists okr_weekly_minimum_targets_update on public.okr_weekly_minimum_targets;
create policy okr_weekly_minimum_targets_update
on public.okr_weekly_minimum_targets
for update
to authenticated
using (public.is_admin_or_owner() and owner_user_id = auth.uid())
with check (public.is_admin_or_owner() and owner_user_id = auth.uid());

drop policy if exists okr_weekly_minimum_targets_delete on public.okr_weekly_minimum_targets;
create policy okr_weekly_minimum_targets_delete
on public.okr_weekly_minimum_targets
for delete
to authenticated
using (public.is_admin_or_owner() and owner_user_id = auth.uid());

-- Grants
grant select on public.okr_weekly_minimum_targets to authenticated;
grant insert, update, delete on public.okr_weekly_minimum_targets to authenticated;
