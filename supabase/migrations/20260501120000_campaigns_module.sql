-- ============================================================
-- VANT · Módulo Campañas
-- Tablas, triggers updated_at, índices únicos con COALESCE, RLS.
--
-- No contiene seed de datos. Ver:
--   20260501150000_campaigns_dev_seed.sql  (solo entornos dev/test)
--
-- Orden de creación (respetando FKs):
--   1. campaigns
--   2. campaign_tracks
--   3. campaign_levels
--   4. campaign_level_rewards
--   5. campaign_imports
--   6. campaign_snapshots
--   7. campaign_import_unmatched_rows
--   8. campaign_reward_awards
-- ============================================================

begin;

-- ============================================================
-- 0) Helper set_updated_at (idempotente — ya existe en el proyecto)
-- ============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- 1) campaigns
-- ============================================================
create table if not exists public.campaigns (
  id                        uuid        primary key default gen_random_uuid(),
  slug                      text        unique not null,
  name                      text        not null,
  description               text,
  metric_type               text        not null,
  unit_label                text        not null,
  color                     text,
  sort_order                int         not null default 0,
  is_active                 boolean     not null default true,
  starts_at                 date,
  ends_at                   date,
  -- Tipo estructural de campaña
  campaign_type             text        not null default 'monthly'
                              check (campaign_type in (
                                'monthly',           -- campaña mensual recurrente (ej. OKR mensual)
                                'fixed_period',      -- campaña temporal con inicio/fin fijo (ej. Fan Fest)
                                'new_advisor_path',  -- carrera para asesores nuevos (ej. Camino a la Cumbre)
                                'multi_track',       -- múltiples caminos/segmentos (ej. Legión Centurión)
                                'ranking'            -- ganadores por posición en ranking
                              )),
  duration_months           int,          -- para new_advisor_path: 18
  eligibility_basis         text,         -- p.ej. 'fecha_concurso' | 'connection_date'
  rules_summary             text,         -- bases generales visibles en UI
  eligibility_rules_summary text,         -- quién puede participar
  -- Reglas de premios
  rewards_are_cumulative    boolean     not null default true,
  max_rewards_per_period    int,          -- p.ej. 1 = solo 1 premio elegible por asesor/periodo
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_campaigns_updated_at'
  ) then
    create trigger trg_campaigns_updated_at
      before update on public.campaigns
      for each row execute function public.set_updated_at();
  end if;
end $$;

-- ============================================================
-- 2) campaign_tracks
--    Caminos dentro de una campaña (opcional — solo multi_track)
-- ============================================================
create table if not exists public.campaign_tracks (
  id          uuid        primary key default gen_random_uuid(),
  campaign_id uuid        not null references public.campaigns(id),
  slug        text        not null,
  name        text        not null,
  description text,
  metric_type text,       -- puede diferir del metric_type de la campaña padre
  unit_label  text,
  sort_order  int         not null default 0,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(campaign_id, slug)
);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_campaign_tracks_updated_at'
  ) then
    create trigger trg_campaign_tracks_updated_at
      before update on public.campaign_tracks
      for each row execute function public.set_updated_at();
  end if;
end $$;

create index if not exists idx_campaign_tracks_campaign_id
  on public.campaign_tracks (campaign_id);

-- ============================================================
-- 3) campaign_levels
--    Niveles/metas por campaña (iguales para todos los asesores)
--    track_id nullable: null = campaña sin caminos
-- ============================================================
create table if not exists public.campaign_levels (
  id          uuid        primary key default gen_random_uuid(),
  campaign_id uuid        not null references public.campaigns(id),
  track_id    uuid        references public.campaign_tracks(id),
  name        text        not null,
  level_order int         not null default 0,
  target_value numeric    not null check (target_value > 0),
  badge_label text,
  color       text,
  is_active   boolean     not null default true,

  -- Premio simple (cuando hay un solo premio por nivel)
  reward_title           text,
  reward_description     text,
  reward_image_url       text,
  reward_terms           text,
  reward_estimated_value numeric,
  reward_is_active       boolean not null default true,

  -- Periodo de evaluación del nivel
  evaluation_period_type text not null default 'monthly'
    check (evaluation_period_type in ('monthly','quarterly','semester','annual','custom')),
  period_label           text,   -- p.ej. "Semestral 2026-H1", "Anual 2026"

  -- Condición de victoria
  win_condition_type text not null default 'threshold'
    check (win_condition_type in ('threshold','ranking_position','hybrid')),
  required_rank      int,                        -- posición requerida (1 = primero)
  ranking_scope      text
    check (ranking_scope in ('global','zone','team','manager_team')),
  tie_breaker_metric text,                       -- p.ej. 'comisiones', 'prima'

  -- Campos para campañas de carrera (new_advisor_path) — ignorados en monthly
  target_month                  int,
  requires_monthly_minimum      boolean not null default false,
  monthly_minimum_description   text,
  requires_active_group         boolean not null default false,
  requires_inforce_ratio        boolean not null default false,
  minimum_inforce_ratio         numeric,
  requires_limra_index          boolean not null default false,
  can_recover_previous_rewards  boolean not null default false,
  recovery_scope                text,
  validation_notes              text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique que maneja track_id nullable correctamente.
-- Postgres permite múltiples NULL en un UNIQUE normal, por eso usamos
-- un índice parcial con COALESCE y un UUID sentinel.
create unique index if not exists uq_campaign_levels_campaign_track_order
  on public.campaign_levels (
    campaign_id,
    coalesce(track_id, '00000000-0000-0000-0000-000000000000'::uuid),
    level_order
  );

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_campaign_levels_updated_at'
  ) then
    create trigger trg_campaign_levels_updated_at
      before update on public.campaign_levels
      for each row execute function public.set_updated_at();
  end if;
end $$;

create index if not exists idx_campaign_levels_campaign_id
  on public.campaign_levels (campaign_id);

create index if not exists idx_campaign_levels_track_id
  on public.campaign_levels (track_id)
  where track_id is not null;

-- ============================================================
-- 4) campaign_level_rewards
--    Premios alternativos/elegibles por nivel
--    Cuando hay is_choice_option = true, el asesor elige uno
-- ============================================================
create table if not exists public.campaign_level_rewards (
  id              uuid    primary key default gen_random_uuid(),
  level_id        uuid    not null references public.campaign_levels(id),
  title           text    not null,
  description     text,
  reward_type     text    not null default 'other'
    check (reward_type in ('cash','physical','trip','discount','recognition','event','other')),
  choice_group    text,            -- opciones del mismo grupo son mutuamente excluyentes
  is_choice_option boolean not null default false,
  sort_order      int      not null default 0,
  is_active       boolean  not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_campaign_level_rewards_updated_at'
  ) then
    create trigger trg_campaign_level_rewards_updated_at
      before update on public.campaign_level_rewards
      for each row execute function public.set_updated_at();
  end if;
end $$;

create index if not exists idx_campaign_level_rewards_level_id
  on public.campaign_level_rewards (level_id);

-- ============================================================
-- 5) campaign_imports
--    Registro de cada sincronización desde Google Sheets
--    período validado en Edge Function, no en DB
-- ============================================================
create table if not exists public.campaign_imports (
  id               uuid        primary key default gen_random_uuid(),
  source           text        not null,
  periodo          text        not null,  -- validado en EF: YYYY-MM | YYYY-H1 | YYYY-Q1 | YYYY | custom
  status           text        not null
    check (status in ('running','completed','completed_with_warnings','error')),
  rows_processed   int         not null default 0,
  rows_inserted    int         not null default 0,
  rows_updated     int         not null default 0,
  rows_skipped     int         not null default 0,
  unmatched_count  int         not null default 0,
  error_message    text,
  triggered_by     uuid        references auth.users(id),
  created_at       timestamptz not null default now(),
  finished_at      timestamptz
);

create index if not exists idx_campaign_imports_periodo_status
  on public.campaign_imports (periodo, status);

-- ============================================================
-- 6) campaign_snapshots
--    Resultados importados (upsert por periodo).
--    El valor importado es el acumulado oficial de Google Sheets —
--    Vant NO debe sumar periodos anteriores.
-- ============================================================
create table if not exists public.campaign_snapshots (
  id                     uuid    primary key default gen_random_uuid(),
  user_id                uuid    not null references auth.users(id),
  campaign_id            uuid    not null references public.campaigns(id),
  track_id               uuid    references public.campaign_tracks(id),
  periodo                text    not null,   -- validado en Edge Function
  metric_type            text    not null,
  value                  numeric not null check (value >= 0),
  source_name            text,
  source_clave_asesor    text    not null,
  import_id              uuid    references public.campaign_imports(id),
  -- Mes del asesor dentro de la campaña (null para monthly)
  advisor_campaign_month int,
  -- Zona para ranking por zona (viene de columna opcional en Sheets)
  source_zone            text,
  -- Valor de desempate (p.ej. comisiones) — columna opcional en Sheets
  tie_breaker_value      numeric,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Unique con COALESCE para manejar track_id nullable
create unique index if not exists uq_campaign_snapshots_user_campaign_track_periodo_metric
  on public.campaign_snapshots (
    user_id,
    campaign_id,
    coalesce(track_id, '00000000-0000-0000-0000-000000000000'::uuid),
    periodo,
    metric_type
  );

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_campaign_snapshots_updated_at'
  ) then
    create trigger trg_campaign_snapshots_updated_at
      before update on public.campaign_snapshots
      for each row execute function public.set_updated_at();
  end if;
end $$;

create index if not exists idx_campaign_snapshots_user_periodo
  on public.campaign_snapshots (user_id, periodo);

create index if not exists idx_campaign_snapshots_campaign_track_periodo
  on public.campaign_snapshots (campaign_id, coalesce(track_id, '00000000-0000-0000-0000-000000000000'::uuid), periodo);

-- ============================================================
-- 7) campaign_import_unmatched_rows
--    Filas de Sheets que no pudieron vincularse
-- ============================================================
create table if not exists public.campaign_import_unmatched_rows (
  id                uuid    primary key default gen_random_uuid(),
  import_id         uuid    not null references public.campaign_imports(id),
  periodo           text    not null,
  clave_asesor      text    not null,
  source_name       text,
  campaign_slug     text,
  track_slug        text,             -- camino de la fila (columna 'camino' en Sheets)
  metric_type       text,
  value             numeric,
  source_zone       text,             -- columna 'zona' en Sheets
  tie_breaker_value numeric,          -- columna 'tie_breaker_value' en Sheets
  reason            text    not null, -- 'advisor_not_found' | 'campaign_not_found' |
                                      -- 'track_not_found' | 'metric_mismatch' |
                                      -- 'duplicate_advisor_code' | 'invalid_row'
  created_at        timestamptz not null default now()
);

create index if not exists idx_campaign_import_unmatched_import_id
  on public.campaign_import_unmatched_rows (import_id);

-- ============================================================
-- 8) campaign_reward_awards
--    Auditoría de premios ganados con trazabilidad de status
-- ============================================================
create table if not exists public.campaign_reward_awards (
  id                          uuid    primary key default gen_random_uuid(),
  user_id                     uuid    not null references auth.users(id),
  campaign_id                 uuid    not null references public.campaigns(id),
  track_id                    uuid    references public.campaign_tracks(id),
  level_id                    uuid    not null references public.campaign_levels(id),
  -- Premio elegido cuando hay opciones (is_choice_option = true)
  selected_reward_id          uuid    references public.campaign_level_rewards(id),
  periodo                     text    not null,
  value_at_award              numeric not null,
  tie_breaker_value_at_award  numeric,
  ranking_position_at_award   int,
  status                      text    not null default 'eligible'
    check (status in (
      'projected',          -- en camino; solo para ranking_position
      'eligible',           -- alcanzó la meta; pendiente verificar condiciones
      'pending_validation', -- en revisión administrativa
      'earned',             -- validado internamente
      'confirmed',          -- confirmado formalmente
      'delivered',          -- premio entregado
      'lost',               -- no cumplió condiciones finales
      'recovered',          -- recuperó premio de nivel anterior
      'cancelled'           -- anulado administrativamente
    )),
  -- Trazabilidad de cambios de status
  status_changed_at           timestamptz,
  status_changed_by           uuid    references auth.users(id),
  awarded_at                  timestamptz not null default now(),
  confirmed_at                timestamptz,
  confirmed_by                uuid    references auth.users(id),
  notes                       text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- Unique con COALESCE para manejar track_id nullable
create unique index if not exists uq_campaign_reward_awards_user_campaign_track_level_periodo
  on public.campaign_reward_awards (
    user_id,
    campaign_id,
    coalesce(track_id, '00000000-0000-0000-0000-000000000000'::uuid),
    level_id,
    periodo
  );

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_campaign_reward_awards_updated_at'
  ) then
    create trigger trg_campaign_reward_awards_updated_at
      before update on public.campaign_reward_awards
      for each row execute function public.set_updated_at();
  end if;
end $$;

create index if not exists idx_campaign_reward_awards_user_periodo
  on public.campaign_reward_awards (user_id, periodo);

create index if not exists idx_campaign_reward_awards_campaign_periodo
  on public.campaign_reward_awards (campaign_id, periodo);

-- ============================================================
-- 9) RLS — habilitar en todas las tablas
-- ============================================================
alter table public.campaigns                    enable row level security;
alter table public.campaign_tracks              enable row level security;
alter table public.campaigns                    force row level security;
alter table public.campaign_tracks              force row level security;
alter table public.campaign_levels              enable row level security;
alter table public.campaign_levels              force row level security;
alter table public.campaign_level_rewards       enable row level security;
alter table public.campaign_level_rewards       force row level security;
alter table public.campaign_imports             enable row level security;
alter table public.campaign_imports             force row level security;
alter table public.campaign_snapshots           enable row level security;
alter table public.campaign_snapshots           force row level security;
alter table public.campaign_import_unmatched_rows enable row level security;
alter table public.campaign_import_unmatched_rows force row level security;
alter table public.campaign_reward_awards       enable row level security;
alter table public.campaign_reward_awards       force row level security;

-- ────────────────────────────────────────────────────────────
-- campaigns — SELECT: todos autenticados; CUD: owner/director
-- ────────────────────────────────────────────────────────────
create policy "campaigns_select_authenticated"
  on public.campaigns for select
  to authenticated
  using (true);

create policy "campaigns_insert_admin"
  on public.campaigns for insert
  to authenticated
  with check (public.auth_role() in ('owner','director'));

create policy "campaigns_update_admin"
  on public.campaigns for update
  to authenticated
  using  (public.auth_role() in ('owner','director'))
  with check (public.auth_role() in ('owner','director'));

create policy "campaigns_delete_owner"
  on public.campaigns for delete
  to authenticated
  using (public.auth_role() = 'owner');

-- ────────────────────────────────────────────────────────────
-- campaign_tracks — igual que campaigns
-- ────────────────────────────────────────────────────────────
create policy "campaign_tracks_select_authenticated"
  on public.campaign_tracks for select
  to authenticated
  using (true);

create policy "campaign_tracks_insert_admin"
  on public.campaign_tracks for insert
  to authenticated
  with check (public.auth_role() in ('owner','director'));

create policy "campaign_tracks_update_admin"
  on public.campaign_tracks for update
  to authenticated
  using  (public.auth_role() in ('owner','director'))
  with check (public.auth_role() in ('owner','director'));

create policy "campaign_tracks_delete_owner"
  on public.campaign_tracks for delete
  to authenticated
  using (public.auth_role() = 'owner');

-- ────────────────────────────────────────────────────────────
-- campaign_levels — igual que campaigns
-- ────────────────────────────────────────────────────────────
create policy "campaign_levels_select_authenticated"
  on public.campaign_levels for select
  to authenticated
  using (true);

create policy "campaign_levels_insert_admin"
  on public.campaign_levels for insert
  to authenticated
  with check (public.auth_role() in ('owner','director'));

create policy "campaign_levels_update_admin"
  on public.campaign_levels for update
  to authenticated
  using  (public.auth_role() in ('owner','director'))
  with check (public.auth_role() in ('owner','director'));

create policy "campaign_levels_delete_owner"
  on public.campaign_levels for delete
  to authenticated
  using (public.auth_role() = 'owner');

-- ────────────────────────────────────────────────────────────
-- campaign_level_rewards — igual que campaigns
-- ────────────────────────────────────────────────────────────
create policy "campaign_level_rewards_select_authenticated"
  on public.campaign_level_rewards for select
  to authenticated
  using (true);

create policy "campaign_level_rewards_insert_admin"
  on public.campaign_level_rewards for insert
  to authenticated
  with check (public.auth_role() in ('owner','director'));

create policy "campaign_level_rewards_update_admin"
  on public.campaign_level_rewards for update
  to authenticated
  using  (public.auth_role() in ('owner','director'))
  with check (public.auth_role() in ('owner','director'));

create policy "campaign_level_rewards_delete_owner"
  on public.campaign_level_rewards for delete
  to authenticated
  using (public.auth_role() = 'owner');

-- ────────────────────────────────────────────────────────────
-- campaign_imports — SELECT: owner/director/seguimiento; CUD: service role
-- ────────────────────────────────────────────────────────────
create policy "campaign_imports_select_ops"
  on public.campaign_imports for select
  to authenticated
  using (public.auth_role() in ('owner','director','seguimiento'));

-- ────────────────────────────────────────────────────────────
-- campaign_import_unmatched_rows — igual
-- ────────────────────────────────────────────────────────────
create policy "campaign_import_unmatched_select_ops"
  on public.campaign_import_unmatched_rows for select
  to authenticated
  using (public.auth_role() in ('owner','director','seguimiento'));

-- ────────────────────────────────────────────────────────────
-- campaign_snapshots — SELECT según rol; CUD: service role únicamente
-- ────────────────────────────────────────────────────────────

-- Asesor: solo sus propios snapshots
create policy "campaign_snapshots_select_advisor"
  on public.campaign_snapshots for select
  to authenticated
  using (
    public.auth_role() = 'advisor'
    and user_id = auth.uid()
  );

-- Manager: sus asesores asignados
create policy "campaign_snapshots_select_manager"
  on public.campaign_snapshots for select
  to authenticated
  using (
    public.auth_role() = 'manager'
    and exists (
      select 1 from public.profiles p
      where p.user_id = campaign_snapshots.user_id
        and p.manager_user_id = auth.uid()
    )
  );

-- Owner / director / seguimiento: todos
create policy "campaign_snapshots_select_ops"
  on public.campaign_snapshots for select
  to authenticated
  using (public.auth_role() in ('owner','director','seguimiento'));

-- ────────────────────────────────────────────────────────────
-- campaign_reward_awards — SELECT según rol; UPDATE vía RPC
-- ────────────────────────────────────────────────────────────

-- Asesor: solo los suyos
create policy "campaign_reward_awards_select_advisor"
  on public.campaign_reward_awards for select
  to authenticated
  using (
    public.auth_role() = 'advisor'
    and user_id = auth.uid()
  );

-- Manager: sus asesores
create policy "campaign_reward_awards_select_manager"
  on public.campaign_reward_awards for select
  to authenticated
  using (
    public.auth_role() = 'manager'
    and exists (
      select 1 from public.profiles p
      where p.user_id = campaign_reward_awards.user_id
        and p.manager_user_id = auth.uid()
    )
  );

-- Ops: todos
create policy "campaign_reward_awards_select_ops"
  on public.campaign_reward_awards for select
  to authenticated
  using (public.auth_role() in ('owner','director','seguimiento'));

-- UPDATE directo sobre campaign_reward_awards está BLOQUEADO para todos los roles.
-- La única vía autorizada para cambiar status es la RPC SECURITY DEFINER
-- `update_reward_award_status`, que valida transiciones de estado y registra
-- status_changed_by / status_changed_at.
-- La RPC bypasea RLS (SECURITY DEFINER → corre como owner del schema), por lo que
-- no necesita una policy de UPDATE en el lado cliente.
--
-- NO crear policy "campaign_reward_awards_update_*" aquí.

-- ============================================================
-- 10) No hay seed de producción en esta migración.
--     Ver 20260501150000_campaigns_dev_seed.sql (dev/test únicamente).
-- ============================================================

commit;
