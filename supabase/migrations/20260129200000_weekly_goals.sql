-- ============================================================
-- Metas semanales por usuario (productividad embudo)
-- Scope: owner_user_id = auth.uid(), 1 fila por usuario
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabla public.weekly_goals
-- ------------------------------------------------------------
create table if not exists public.weekly_goals (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,

  contactos_nuevos int not null default 20,
  citas_agendadas int not null default 8,
  casos_abiertos int not null default 6,
  citas_cierre int not null default 3,
  solicitudes_ingresadas int not null default 1,
  casos_ganados int not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint weekly_goals_owner_unique unique (owner_user_id),
  constraint weekly_goals_contactos_nuevos_nonneg check (contactos_nuevos >= 0),
  constraint weekly_goals_citas_agendadas_nonneg check (citas_agendadas >= 0),
  constraint weekly_goals_casos_abiertos_nonneg check (casos_abiertos >= 0),
  constraint weekly_goals_citas_cierre_nonneg check (citas_cierre >= 0),
  constraint weekly_goals_solicitudes_ingresadas_nonneg check (solicitudes_ingresadas >= 0),
  constraint weekly_goals_casos_ganados_nonneg check (casos_ganados >= 0)
);

-- ------------------------------------------------------------
-- 2) Trigger updated_at
-- ------------------------------------------------------------
drop trigger if exists t_weekly_goals_updated_at on public.weekly_goals;
create trigger t_weekly_goals_updated_at
  before update on public.weekly_goals
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 3) Índice (único ya cubre búsqueda por owner)
-- ------------------------------------------------------------
create index if not exists weekly_goals_owner_user_id_idx
  on public.weekly_goals (owner_user_id);

-- ------------------------------------------------------------
-- 4) RLS
-- ------------------------------------------------------------
alter table public.weekly_goals enable row level security;

drop policy if exists weekly_goals_select_own on public.weekly_goals;
create policy weekly_goals_select_own
  on public.weekly_goals for select
  using (owner_user_id = auth.uid());

drop policy if exists weekly_goals_insert_own on public.weekly_goals;
create policy weekly_goals_insert_own
  on public.weekly_goals for insert
  with check (owner_user_id = auth.uid());

drop policy if exists weekly_goals_update_own on public.weekly_goals;
create policy weekly_goals_update_own
  on public.weekly_goals for update
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists weekly_goals_delete_own on public.weekly_goals;
create policy weekly_goals_delete_own
  on public.weekly_goals for delete
  using (owner_user_id = auth.uid());
