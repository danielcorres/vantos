-- 20260112123000_okr_global_settings_and_scoring.sql
-- ============================================================
-- OKR: Scoring GLOBAL (admin) + Settings GLOBAL
-- - NO alteramos okr_metric_scores (per-user) para evitar NOT NULL y dependencias
-- - Creamos okr_metric_scores_global (1 fila por metric_key) y migramos datos
-- - Re-creamos views principales para calcular puntos usando scoring global
-- ============================================================

-- ============================================================
-- 0) Helper updated_at (idempotente)
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
-- 1) Settings globales (1 fila)
-- ============================================================
create table if not exists public.okr_settings_global (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid,
  daily_expected_points int not null default 25,
  weekly_days int not null default 5,
  tiers jsonb not null default '[
    {"key":"warmup","min":0,"max":24,"label":"Arranque","message":"Empieza con una victoria pequeña: 1 llamada + 1 seguimiento.","tone":"neutral","color":"slate"},
    {"key":"momentum","min":25,"max":29,"label":"En camino","message":"Ya estás cerca. Completa lo esperado del día.","tone":"info","color":"blue"},
    {"key":"expected","min":30,"max":39,"label":"Actividad esperada","message":"✅ Día sólido. Mantén el ritmo.","tone":"success","color":"green"},
    {"key":"overdrive","min":40,"max":1000,"label":"Alto rendimiento","message":"🔥 Día imparable. Esto multiplica tu semana.","tone":"special","color":"amber"}
  ]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_okr_settings_global_updated_at') then
    create trigger trg_okr_settings_global_updated_at
    before update on public.okr_settings_global
    for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.okr_settings_global enable row level security;

drop policy if exists okr_settings_global_select_all on public.okr_settings_global;
create policy okr_settings_global_select_all
on public.okr_settings_global
for select
to authenticated
using (true);

drop policy if exists okr_settings_global_insert_bootstrap_or_owner on public.okr_settings_global;
create policy okr_settings_global_insert_bootstrap_or_owner
on public.okr_settings_global
for insert
to authenticated
with check (
  not exists (select 1 from public.okr_settings_global)
  or auth.uid() = (select owner_user_id from public.okr_settings_global order by created_at asc limit 1)
);

drop policy if exists okr_settings_global_update_owner on public.okr_settings_global;
create policy okr_settings_global_update_owner
on public.okr_settings_global
for update
to authenticated
using (
  auth.uid() = (select owner_user_id from public.okr_settings_global order by created_at asc limit 1)
)
with check (
  auth.uid() = (select owner_user_id from public.okr_settings_global order by created_at asc limit 1)
);

drop policy if exists okr_settings_global_delete_owner on public.okr_settings_global;
create policy okr_settings_global_delete_owner
on public.okr_settings_global
for delete
to authenticated
using (
  auth.uid() = (select owner_user_id from public.okr_settings_global order by created_at asc limit 1)
);

grant select on public.okr_settings_global to authenticated;

create or replace function public.get_okr_settings_global()
returns table (
  owner_user_id uuid,
  daily_expected_points int,
  weekly_days int,
  tiers jsonb
)
language sql
security invoker
stable
set search_path = public
as $$
  select
    (select s.owner_user_id from public.okr_settings_global s order by s.created_at asc limit 1) as owner_user_id,
    coalesce((select s.daily_expected_points from public.okr_settings_global s order by s.created_at asc limit 1), 25)::int as daily_expected_points,
    coalesce((select s.weekly_days from public.okr_settings_global s order by s.created_at asc limit 1), 5)::int as weekly_days,
    coalesce((select s.tiers from public.okr_settings_global s order by s.created_at asc limit 1),
      '[
        {"key":"warmup","min":0,"max":24,"label":"Arranque","message":"Empieza con una victoria pequeña: 1 llamada + 1 seguimiento.","tone":"neutral","color":"slate"},
        {"key":"momentum","min":25,"max":29,"label":"En camino","message":"Ya estás cerca. Completa lo esperado del día.","tone":"info","color":"blue"},
        {"key":"expected","min":30,"max":39,"label":"Actividad esperada","message":"✅ Día sólido. Mantén el ritmo.","tone":"success","color":"green"},
        {"key":"overdrive","min":40,"max":1000,"label":"Alto rendimiento","message":"🔥 Día imparable. Esto multiplica tu semana.","tone":"special","color":"amber"}
      ]'::jsonb
    ) as tiers;
$$;

grant execute on function public.get_okr_settings_global() to authenticated;

-- ============================================================
-- 2) Scoring GLOBAL (admin)
-- ============================================================
create table if not exists public.okr_metric_scores_global (
  metric_key text primary key,
  points_per_unit int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_okr_metric_scores_global_updated_at') then
    create trigger trg_okr_metric_scores_global_updated_at
    before update on public.okr_metric_scores_global
    for each row execute function public.set_updated_at();
  end if;
end $$;

alter table public.okr_metric_scores_global enable row level security;

drop policy if exists okr_metric_scores_global_select_all on public.okr_metric_scores_global;
create policy okr_metric_scores_global_select_all
on public.okr_metric_scores_global
for select
to authenticated
using (true);

drop policy if exists okr_metric_scores_global_write_owner on public.okr_metric_scores_global;
create policy okr_metric_scores_global_write_owner
on public.okr_metric_scores_global
for all
to authenticated
using (
  auth.uid() = (select owner_user_id from public.okr_settings_global order by created_at asc limit 1)
)
with check (
  auth.uid() = (select owner_user_id from public.okr_settings_global order by created_at asc limit 1)
);

grant select on public.okr_metric_scores_global to authenticated;

-- ============================================================
-- 3) Migración de datos: per-user -> global (dedupe por metric_key)
--    Conserva MAX(points_per_unit)
-- ============================================================
insert into public.okr_metric_scores_global (metric_key, points_per_unit)
select s.metric_key, max(s.points_per_unit)::int as points_per_unit
from public.okr_metric_scores s
group by s.metric_key
on conflict (metric_key) do update
set points_per_unit = excluded.points_per_unit;

-- ============================================================
-- 4) Re-crear views usando scoring GLOBAL
-- ============================================================

-- Limpia vistas dependientes si existían en versiones anteriores
drop view if exists public.okr_points_progress_by_date;
drop view if exists public.okr_week_metric_totals;

-- Progreso del día (puntos actuales + meta esperada)
create or replace view public.okr_points_progress_by_date
with (security_invoker = true)
as
with params as (
  select (now() at time zone 'America/Monterrey')::date as day_local
),
settings as (
  select coalesce((select daily_expected_points from public.get_okr_settings_global() limit 1), 25)::int as base_target
),
scores as (
  select metric_key, points_per_unit
  from public.okr_metric_scores_global
),
today_events as (
  select
    e.metric_key,
    sum(e.value)::int as total_value
  from public.activity_events e
  join params p on true
  where e.actor_user_id = auth.uid()
    and e.is_void = false
    and e.source = 'manual'
    and e.metadata->>'entry_source' = 'okr_daily'
    and (e.recorded_at at time zone 'America/Monterrey')::date = p.day_local
  group by 1
),
total_points as (
  select
    coalesce(sum(te.total_value * coalesce(s.points_per_unit, 0)), 0)::int as current_points
  from today_events te
  left join scores s on s.metric_key = te.metric_key
)
select
  tp.current_points,
  st.base_target
from total_points tp
cross join settings st;

grant select on public.okr_points_progress_by_date to authenticated;

-- Totales semanales por métrica (excluye pipeline.*)
create or replace view public.okr_week_metric_totals
with (security_invoker = true)
as
with now_local as (
  select now() at time zone 'America/Monterrey' as ts
),
bounds as (
  select
    date_trunc('week', ts)::date as week_start,
    (date_trunc('week', ts)::date + 7) as week_end
  from now_local
),
scores as (
  select metric_key, points_per_unit
  from public.okr_metric_scores_global
),
weekly as (
  select
    (e.recorded_at at time zone 'America/Monterrey')::date as day_local,
    e.metric_key,
    sum(e.value)::int as total_value
  from public.activity_events e
  join bounds b on true
  where e.actor_user_id = auth.uid()
    and e.is_void = false
    and e.source = 'manual'
    and e.metadata->>'entry_source' = 'okr_daily'
    and (e.recorded_at at time zone 'America/Monterrey')::date >= b.week_start
    and (e.recorded_at at time zone 'America/Monterrey')::date < b.week_end
  group by 1,2
)
select
  w.metric_key,
  sum(w.total_value)::int as total_value,
  coalesce(s.points_per_unit, 0)::int as points_per_unit,
  (sum(w.total_value) * coalesce(s.points_per_unit, 0))::int as total_points
from weekly w
left join scores s on s.metric_key = w.metric_key
where w.metric_key not like 'pipeline.%'
group by 1,3;

grant select on public.okr_week_metric_totals to authenticated;
