-- ============================================================
-- Fix: OKR Semana - Scoring GLOBAL y cálculo de puntos semanales
-- - Corrige okr_week_metric_totals para usar okr_metric_scores_global
-- - Agrega columna total_points_week para compatibilidad con frontend
-- - Crea RPC get_okr_week_points_progress para total semanal
-- ============================================================

begin;

-- 1) Corregir vista okr_week_metric_totals para usar scoring GLOBAL
drop view if exists public.okr_week_metric_totals;

create view public.okr_week_metric_totals
with (security_invoker = true)
as
with tz as (
  select (now() at time zone 'America/Monterrey')::date as today_local
),
week_bounds as (
  select
    date_trunc('week', today_local::timestamp)::date as week_start_local, -- lunes
    (date_trunc('week', today_local::timestamp)::date + 7) as week_end_local
  from tz
),
daily_totals as (
  select
    (e.recorded_at at time zone 'America/Monterrey')::date as day_local,
    e.metric_key,
    sum(e.value)::int as total_value
  from public.activity_events e
  join week_bounds b on true
  where e.actor_user_id = auth.uid()
    and e.is_void = false
    and e.source = 'manual'
    and coalesce(e.metadata->>'entry_source', '') = 'okr_daily'
    and (e.recorded_at at time zone 'America/Monterrey')::date >= b.week_start_local
    and (e.recorded_at at time zone 'America/Monterrey')::date <  b.week_end_local
  group by 1,2
),
pivoted as (
  select
    dt.metric_key,
    -- ISO DOW: Mon=1 ... Sun=7
    sum(case when extract(isodow from dt.day_local) = 1 then dt.total_value else 0 end)::int as lun,
    sum(case when extract(isodow from dt.day_local) = 2 then dt.total_value else 0 end)::int as mar,
    sum(case when extract(isodow from dt.day_local) = 3 then dt.total_value else 0 end)::int as mie,
    sum(case when extract(isodow from dt.day_local) = 4 then dt.total_value else 0 end)::int as jue,
    sum(case when extract(isodow from dt.day_local) = 5 then dt.total_value else 0 end)::int as vie,
    sum(case when extract(isodow from dt.day_local) = 6 then dt.total_value else 0 end)::int as sab,
    sum(case when extract(isodow from dt.day_local) = 7 then dt.total_value else 0 end)::int as dom,
    sum(dt.total_value)::int as total_value
  from daily_totals dt
  group by dt.metric_key
)
select
  md.key as metric_key,
  md.label,
  md.sort_order::int as sort_order,
  coalesce(p.lun, 0) as lun,
  coalesce(p.mar, 0) as mar,
  coalesce(p.mie, 0) as mie,
  coalesce(p.jue, 0) as jue,
  coalesce(p.vie, 0) as vie,
  coalesce(p.sab, 0) as sab,
  coalesce(p.dom, 0) as dom,
  coalesce(p.total_value, 0) as total_value_week,
  coalesce(s.points_per_unit, 0)::int as points_per_unit,
  (coalesce(p.total_value, 0) * coalesce(s.points_per_unit, 0))::int as total_points_week
from public.metric_definitions md
left join pivoted p on p.metric_key = md.key
left join public.okr_metric_scores_global s on s.metric_key = md.key  -- 🔧 FIX: usa scoring GLOBAL
where md.is_active = true
  and md.key not like 'pipeline.%'
order by md.sort_order, md.key;

grant select on public.okr_week_metric_totals to authenticated;

-- 2) RPC para obtener progreso semanal (total de puntos)
create or replace function public.get_okr_week_points_progress()
returns table (
  total_week_points integer,
  week_start_local date,
  week_end_local date
)
language sql
stable
security invoker
as $$
  with tz as (
    select (now() at time zone 'America/Monterrey')::date as today_local
  ),
  week_bounds as (
    select
      date_trunc('week', today_local::timestamp)::date as week_start_local,
      (date_trunc('week', today_local::timestamp)::date + 7) as week_end_local
    from tz
  ),
  weekly_points as (
    select
      coalesce(sum(e.value * coalesce(g.points_per_unit, 0)), 0)::int as total_points
    from public.activity_events e
    left join public.okr_metric_scores_global g on g.metric_key = e.metric_key
    cross join week_bounds b
    where e.actor_user_id = auth.uid()
      and e.is_void = false
      and e.source = 'manual'
      and e.metadata->>'entry_source' = 'okr_daily'
      and (e.recorded_at at time zone 'America/Monterrey')::date >= b.week_start_local
      and (e.recorded_at at time zone 'America/Monterrey')::date < b.week_end_local
  )
  select
    wp.total_points as total_week_points,
    b.week_start_local,
    b.week_end_local
  from weekly_points wp
  cross join week_bounds b;
$$;

grant execute on function public.get_okr_week_points_progress() to authenticated;

-- 3) Corregir vista okr_week_daily_summary para usar scoring GLOBAL (si aún no lo hace)
drop view if exists public.okr_week_daily_summary;

create or replace view public.okr_week_daily_summary
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
  from public.okr_metric_scores_global  -- 🔧 FIX: usa scoring GLOBAL
),
daily as (
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
  d.day_local,
  md.key as metric_key,
  md.label,
  md.sort_order,
  d.total_value as total_value,
  coalesce(s.points_per_unit, 0)::int as points_per_unit,
  (d.total_value * coalesce(s.points_per_unit, 0))::int as total_points
from daily d
join public.metric_definitions md on md.key = d.metric_key
left join scores s on s.metric_key = md.key
where md.is_active = true
  and md.key not like 'pipeline.%'
order by d.day_local, md.sort_order;

grant select on public.okr_week_daily_summary to authenticated;

commit;
