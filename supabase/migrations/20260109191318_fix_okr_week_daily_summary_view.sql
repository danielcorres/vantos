create or replace view public.okr_week_daily_summary
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
daily as (
  select
    (e.recorded_at at time zone 'America/Monterrey')::date as day_local,
    e.metric_key,
    sum(e.value)::int as total_value
  from public.activity_events e
  join week_bounds b on true
  where e.actor_user_id = auth.uid()
    and e.is_void = false
    and e.source = 'manual'
    and e.metadata->>'entry_source' = 'okr_daily'
    and e.recorded_at >= b.week_start
    and e.recorded_at < b.week_end
  group by 1,2
),
active_rules as (
  select pr.metric_key, pr.points
  from public.point_rules pr
  join week_bounds b on true
  where pr.effective_from <= b.today_local
    and (pr.effective_to is null or pr.effective_to > b.today_local)
)
select
  d.day_local,
  md.key as metric_key,
  md.label,
  md.sort_order,
  d.total_value as total_value,
  coalesce(ar.points, 0) as points_per_unit,
  (d.total_value * coalesce(ar.points, 0))::int as total_points
from daily d
join public.metric_definitions md on md.key = d.metric_key
left join active_rules ar on ar.metric_key = d.metric_key
where md.key not like 'pipeline.%';

grant select on public.okr_week_daily_summary to authenticated;
