-- ============================================================
-- Fix: okr_week_metric_totals con label + sort_order + LUN..DOM
-- - excluye pipeline.*
-- - fuente: activity_events (source='manual' + entry_source='okr_daily')
-- - usa recorded_at en America/Monterrey
-- ============================================================

begin;

-- 1) Drop para poder cambiar el esquema de columnas sin error
drop view if exists public.okr_week_metric_totals;

-- 2) Crear vista nueva con columnas estables y ordenadas
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
  coalesce(p.total_value, 0) as total_value,
  coalesce(s.points_per_unit, 0)::int as points_per_unit,
  (coalesce(p.total_value, 0) * coalesce(s.points_per_unit, 0))::int as total_points
from public.metric_definitions md
left join pivoted p on p.metric_key = md.key
left join public.okr_metric_scores s on s.metric_key = md.key
where md.key not like 'pipeline.%';

-- 3) Permisos
grant select on public.okr_week_metric_totals to authenticated;

commit;
