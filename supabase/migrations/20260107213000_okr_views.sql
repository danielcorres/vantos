-- 20260107213000_okr_views.sql
-- OKR summary views for Today + Week (America/Monterrey)

begin;

-- ----------------------------
-- View: okr_today_summary
-- One row per active metric for the current user (auth.uid()).
-- Uses happened_at for "today" window in America/Monterrey.
-- ----------------------------
create or replace view public.okr_today_summary
with (security_invoker = true)
as
with bounds as (
  select
    (date_trunc('day', (now() at time zone 'America/Monterrey')) at time zone 'America/Monterrey') as day_start,
    ((date_trunc('day', (now() at time zone 'America/Monterrey')) + interval '1 day') at time zone 'America/Monterrey') as day_end,
    (now() at time zone 'America/Monterrey')::date as today_local
),
today_events as (
  select e.metric_key, sum(e.value)::int as total_value
  from public.activity_events e
  join bounds b on true
  where e.actor_user_id = auth.uid()
    and e.is_void = false
    and e.happened_at >= b.day_start
    and e.happened_at < b.day_end
  group by e.metric_key
),
active_rules as (
  select pr.metric_key, pr.points
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
  (coalesce(te.total_value, 0) * coalesce(ar.points, 0))::int as total_points_today
from public.metric_definitions md
left join today_events te on te.metric_key = md.key
left join active_rules ar on ar.metric_key = md.key
where md.is_active = true
order by md.sort_order;

-- ----------------------------
-- View: okr_week_daily_summary
-- Sparse rows: only days/metrics that have activity this week.
-- Week = ISO week start (Monday) in America/Monterrey.
-- Uses happened_at to bucket by local day.
-- ----------------------------
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
    (e.happened_at at time zone 'America/Monterrey')::date as day_local,
    e.metric_key,
    sum(e.value)::int as total_value
  from public.activity_events e
  join week_bounds b on true
  where e.actor_user_id = auth.uid()
    and e.is_void = false
    and e.happened_at >= b.week_start
    and e.happened_at < b.week_end
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
order by d.day_local asc, md.sort_order asc;

-- ----------------------------
-- (Optional but useful) View: okr_week_metric_totals
-- Totals per metric for the current week (for a simple weekly header).
-- ----------------------------
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
    and e.happened_at >= b.week_start
    and e.happened_at < b.week_end
  group by e.metric_key
),
active_rules as (
  select pr.metric_key, pr.points
  from public.point_rules pr
  join week_bounds b on true
  where pr.effective_from <= b.today_local
    and (pr.effective_to is null or pr.effective_to > b.today_local)
)
select
  md.key as metric_key,
  md.label,
  md.sort_order,
  coalesce(we.total_value, 0) as total_value_week,
  coalesce(ar.points, 0) as points_per_unit,
  (coalesce(we.total_value, 0) * coalesce(ar.points, 0))::int as total_points_week
from public.metric_definitions md
left join week_events we on we.metric_key = md.key
left join active_rules ar on ar.metric_key = md.key
where md.is_active = true
order by md.sort_order;

-- ----------------------------
-- Grants (views are readable by authenticated users)
-- ----------------------------
grant select on public.okr_today_summary to authenticated;
grant select on public.okr_week_daily_summary to authenticated;
grant select on public.okr_week_metric_totals to authenticated;

commit;
