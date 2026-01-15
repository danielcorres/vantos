-- ============================================================
-- Pipeline v1: Métricas (duración por etapa, estancados, embudo)
-- Modelo: single-agency, sin org_id, RLS por usuario (owner_user_id)
-- TZ: America/Monterrey para KPIs por día
-- ============================================================

-- ----------------------------
-- 1) Vista: Leads con etapa actual + días en etapa
-- ----------------------------
create or replace view public.pipeline_leads_current as
select
  l.id as lead_id,
  l.owner_user_id,
  l.full_name,
  l.phone,
  l.email,
  l.source,
  l.notes,
  l.stage_id,
  s.name as stage_name,
  s.position as stage_position,
  l.stage_changed_at,
  l.created_at,
  l.updated_at,
  -- días en etapa (base: stage_changed_at; fallback a created_at)
  greatest(
    0,
    ((now() at time zone 'America/Monterrey')::date
      - (coalesce(l.stage_changed_at, l.created_at) at time zone 'America/Monterrey')::date)
  )::int as days_in_stage
from public.leads l
join public.pipeline_stages s on s.id = l.stage_id
where l.owner_user_id = auth.uid();

-- ----------------------------
-- 2) Vista: Eventos de duración por etapa (cada movimiento genera 1 duración)
--    duración = moved_at - prev_anchor
--    prev_anchor = moved_at anterior del mismo lead, o created_at si es el primer movimiento
-- ----------------------------
create or replace view public.pipeline_stage_duration_events as
with hist as (
  select
    h.id as history_id,
    h.lead_id,
    h.from_stage_id,
    h.to_stage_id,
    h.moved_by,
    h.moved_at,
    lag(h.moved_at) over (partition by h.lead_id order by h.moved_at) as prev_moved_at
  from public.lead_stage_history h
  where h.moved_by = auth.uid()
)
select
  hist.history_id,
  hist.lead_id,
  hist.from_stage_id as stage_id,              -- tiempo que pasó en from_stage
  s.name as stage_name,
  s.position as stage_position,
  hist.to_stage_id,
  hist.moved_by,
  hist.moved_at,
  coalesce(hist.prev_moved_at, l.created_at) as stage_entered_at,
  extract(epoch from (hist.moved_at - coalesce(hist.prev_moved_at, l.created_at)))::bigint as duration_seconds,
  (hist.moved_at at time zone 'America/Monterrey')::date as moved_date_mty
from hist
join public.leads l on l.id = hist.lead_id
join public.pipeline_stages s on s.id = hist.from_stage_id
where l.owner_user_id = auth.uid();

-- ----------------------------
-- 3) Vista: Stats por etapa (all-time) basadas en duration_events
-- ----------------------------
create or replace view public.pipeline_stage_duration_stats as
select
  stage_id,
  stage_name,
  stage_position,
  count(*)::int as samples,
  round(avg(duration_seconds))::bigint as avg_seconds,
  round(percentile_cont(0.5) within group (order by duration_seconds))::bigint as median_seconds,
  round(percentile_cont(0.9) within group (order by duration_seconds))::bigint as p90_seconds
from public.pipeline_stage_duration_events
group by stage_id, stage_name, stage_position
order by stage_position;

-- ----------------------------
-- 4) Vista: Stats por etapa (últimos 30 días, por fecha de movimiento)
-- ----------------------------
create or replace view public.pipeline_stage_duration_stats_30d as
select
  stage_id,
  stage_name,
  stage_position,
  count(*)::int as samples_30d,
  round(avg(duration_seconds))::bigint as avg_seconds_30d,
  round(percentile_cont(0.5) within group (order by duration_seconds))::bigint as median_seconds_30d,
  round(percentile_cont(0.9) within group (order by duration_seconds))::bigint as p90_seconds_30d
from public.pipeline_stage_duration_events
where moved_date_mty >= ((now() at time zone 'America/Monterrey')::date - 30)
group by stage_id, stage_name, stage_position
order by stage_position;

-- ----------------------------
-- 5) Vista: Embudo actual (conteo de leads por etapa actual)
-- ----------------------------
create or replace view public.pipeline_funnel_current as
select
  s.id as stage_id,
  s.name as stage_name,
  s.position as stage_position,
  count(l.id)::int as leads_count
from public.pipeline_stages s
left join public.leads l
  on l.stage_id = s.id
 and l.owner_user_id = auth.uid()
where s.is_active = true
group by s.id, s.name, s.position
order by s.position;

-- ----------------------------
-- 6) Vista: Transiciones 30 días (from -> to) por usuario
-- ----------------------------
create or replace view public.pipeline_transitions_30d as
select
  fs.id as from_stage_id,
  fs.name as from_stage_name,
  fs.position as from_stage_position,
  ts.id as to_stage_id,
  ts.name as to_stage_name,
  ts.position as to_stage_position,
  count(*)::int as moves_30d
from public.lead_stage_history h
join public.leads l on l.id = h.lead_id
join public.pipeline_stages fs on fs.id = h.from_stage_id
join public.pipeline_stages ts on ts.id = h.to_stage_id
where l.owner_user_id = auth.uid()
  and h.moved_by = auth.uid()
  and (h.moved_at at time zone 'America/Monterrey')::date >= ((now() at time zone 'America/Monterrey')::date - 30)
group by
  fs.id, fs.name, fs.position,
  ts.id, ts.name, ts.position
order by fs.position, ts.position;

-- ----------------------------
-- 7) Function: Leads estancados (parametrizable)
-- ----------------------------
create or replace function public.pipeline_stuck_leads(p_days int default 7)
returns table (
  lead_id uuid,
  full_name text,
  phone text,
  email text,
  source text,
  stage_id uuid,
  stage_name text,
  stage_position int,
  days_in_stage int,
  stage_changed_at timestamptz,
  created_at timestamptz
)
language sql
security invoker
as $$
  select
    plc.lead_id,
    plc.full_name,
    plc.phone,
    plc.email,
    plc.source,
    plc.stage_id,
    plc.stage_name,
    plc.stage_position,
    plc.days_in_stage,
    plc.stage_changed_at,
    plc.created_at
  from public.pipeline_leads_current plc
  where plc.days_in_stage >= p_days
  order by plc.days_in_stage desc, plc.stage_position asc, plc.created_at asc;
$$;

grant execute on function public.pipeline_stuck_leads(int) to authenticated;

-- ----------------------------
-- 8) Vista: KPIs de hoy (Monterrey)
-- ----------------------------
create or replace view public.pipeline_kpis_today as
with b as (
  select (now() at time zone 'America/Monterrey')::date as today_mty
),
moves as (
  select count(*)::int as moves_today
  from public.lead_stage_history h
  join public.leads l on l.id = h.lead_id
  join b on true
  where l.owner_user_id = auth.uid()
    and h.moved_by = auth.uid()
    and (h.moved_at at time zone 'America/Monterrey')::date = b.today_mty
),
created as (
  select count(*)::int as leads_created_today
  from public.leads l
  join b on true
  where l.owner_user_id = auth.uid()
    and (l.created_at at time zone 'America/Monterrey')::date = b.today_mty
)
select
  (select moves_today from moves) as moves_today,
  (select leads_created_today from created) as leads_created_today;
