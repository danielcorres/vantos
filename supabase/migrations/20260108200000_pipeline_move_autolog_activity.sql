-- OKR Hoy: contar por recorded_at (ventana Monterrey)
create or replace view public.okr_today_summary as
with bounds as (
  select
    (date_trunc('day', now() at time zone 'America/Monterrey') at time zone 'America/Monterrey') as day_start,
    ((date_trunc('day', now() at time zone 'America/Monterrey') + interval '1 day') at time zone 'America/Monterrey') as day_end,
    (now() at time zone 'America/Monterrey')::date as today_local
),
today_events as (
  select
    e.metric_key,
    sum(e.value)::integer as total_value
  from public.activity_events e
  join bounds b on true
  where e.actor_user_id = auth.uid()
    and e.is_void = false
    and e.recorded_at >= b.day_start
    and e.recorded_at < b.day_end
  group by e.metric_key
),
active_rules as (
  select
    pr.metric_key,
    pr.points
  from public.point_rules pr
  join bounds b on true
  where pr.effective_from <= b.today_local
    and (pr.effective_to is null or pr.effective_to > b.today_local)
)
select
  md.key as metric_key,
  md.label,
  md.unit,
  md.sort_order,
  coalesce(te.total_value, 0) as total_value_today,
  coalesce(ar.points, 0) as points_per_unit,
  coalesce(te.total_value, 0) * coalesce(ar.points, 0) as total_points_today
from public.metric_definitions md
left join today_events te on te.metric_key = md.key
left join active_rules ar on ar.metric_key = md.key
where md.is_active = true
order by md.sort_order;
