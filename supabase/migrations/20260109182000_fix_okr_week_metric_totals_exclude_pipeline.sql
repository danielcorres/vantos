-- 20260109182000_fix_okr_week_metric_totals_exclude_pipeline.sql
-- Actualizar okr_week_metric_totals para excluir métricas pipeline.* y usar okr_metric_scores

begin;

create or replace view public.okr_week_metric_totals
with (security_invoker = true)
as
with tz as (
  select now() at time zone 'America/Monterrey' as now_local
),
week_bounds as (
  select
    (date_trunc('week', now_local)::timestamp) at time zone 'America/Monterrey' as week_start,
    ((date_trunc('week', now_local)::timestamp + interval '7 days')) at time zone 'America/Monterrey' as week_end,
    (now_local)::date as today_local
  from tz
),
week_events as (
  select e.metric_key, sum(e.value)::int as total_value
  from public.activity_events e
  join week_bounds b on true
  where e.actor_user_id = auth.uid()
    and e.is_void = false
    and e.source = 'manual'
    and e.metadata->>'entry_source' = 'okr_daily'
    and e.recorded_at >= b.week_start
    and e.recorded_at < b.week_end
  group by e.metric_key
)
select
  md.key as metric_key,
  md.label,
  md.sort_order,
  coalesce(we.total_value, 0) as total_value_week,
  coalesce(oms.points_per_unit, 0) as points_per_unit,
  (coalesce(we.total_value, 0) * coalesce(oms.points_per_unit, 0))::int as total_points_week
from public.metric_definitions md
left join week_events we on we.metric_key = md.key
left join public.okr_metric_scores oms
  on oms.user_id = auth.uid()
  and oms.metric_key = md.key
where md.is_active = true
  and md.key not like 'pipeline.%'
order by md.sort_order;

grant select on public.okr_week_metric_totals to authenticated;

commit;
