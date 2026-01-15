-- 20260109173000_okr_daily_decouple_pipeline.sql
-- Desligar OKR Diario del Pipeline: solo usar eventos okr_daily manual

begin;

-- ----------------------------
-- Actualizar vista okr_points_progress_by_date
-- ----------------------------
create or replace view public.okr_points_progress_by_date
with (security_invoker = true)
as
select
  (now() at time zone 'America/Monterrey')::date as date_local,
  coalesce(
    (
      select sum(e.value * coalesce(oms.points_per_unit, 0))
      from public.activity_events e
      left join public.okr_metric_scores oms
        on oms.user_id = e.actor_user_id
        and oms.metric_key = e.metric_key
      where e.actor_user_id = auth.uid()
        and e.is_void = false
        and e.source = 'manual'
        and e.metadata->>'entry_source' = 'okr_daily'
        and (e.recorded_at at time zone 'America/Monterrey')::date = (now() at time zone 'America/Monterrey')::date
    ),
    0
  )::integer as current_points,
  coalesce(
    (
      select target_value
      from public.targets
      where user_id = auth.uid()
        and metric_key = 'points'
        and period_type in ('daily', 'weekly', 'monthly')
        and period_start <= (now() at time zone 'America/Monterrey')::date
      order by 
        case period_type
          when 'daily' then 1
          when 'weekly' then 2
          when 'monthly' then 3
        end,
        period_start desc
      limit 1
    ),
    100
  )::integer as base_target,
  round(
    coalesce(
      (
        select target_value
        from public.targets
        where user_id = auth.uid()
          and metric_key = 'points'
          and period_type in ('daily', 'weekly', 'monthly')
          and period_start <= (now() at time zone 'America/Monterrey')::date
        order by 
          case period_type
            when 'daily' then 1
            when 'weekly' then 2
            when 'monthly' then 3
          end,
          period_start desc
        limit 1
      ),
      100
    ) * 1.5
  )::integer as stretch_target,
  greatest(
    coalesce(
      (
        select sum(e.value * coalesce(oms.points_per_unit, 0))
        from public.activity_events e
        left join public.okr_metric_scores oms
          on oms.user_id = e.actor_user_id
          and oms.metric_key = e.metric_key
        where e.actor_user_id = auth.uid()
          and e.is_void = false
          and e.source = 'manual'
          and e.metadata->>'entry_source' = 'okr_daily'
          and (e.recorded_at at time zone 'America/Monterrey')::date = (now() at time zone 'America/Monterrey')::date
      ),
      0
    ) - coalesce(
      (
        select target_value
        from public.targets
        where user_id = auth.uid()
          and metric_key = 'points'
          and period_type in ('daily', 'weekly', 'monthly')
          and period_start <= (now() at time zone 'America/Monterrey')::date
        order by 
          case period_type
            when 'daily' then 1
            when 'weekly' then 2
            when 'monthly' then 3
          end,
          period_start desc
        limit 1
      ),
      100
    ),
    0
  )::integer as extra_points;

grant select on public.okr_points_progress_by_date to authenticated;

-- ----------------------------
-- Actualizar RPC get_okr_points_progress
-- ----------------------------
create or replace function public.get_okr_points_progress(
  p_date_local date
)
returns table (
  date_local date,
  current_points integer,
  base_target integer,
  stretch_target integer,
  extra_points integer
)
language sql
security invoker
set search_path = public
stable
as $$
  select
    p_date_local as date_local,
    coalesce(
      (
        select sum(e.value * coalesce(oms.points_per_unit, 0))
        from public.activity_events e
        left join public.okr_metric_scores oms
          on oms.user_id = e.actor_user_id
          and oms.metric_key = e.metric_key
        where e.actor_user_id = auth.uid()
          and e.is_void = false
          and e.source = 'manual'
          and e.metadata->>'entry_source' = 'okr_daily'
          and (e.recorded_at at time zone 'America/Monterrey')::date = p_date_local
      ),
      0
    )::integer as current_points,
    coalesce(
      (
        select target_value
        from public.targets
        where user_id = auth.uid()
          and metric_key = 'points'
          and period_type in ('daily', 'weekly', 'monthly')
          and period_start <= p_date_local
        order by 
          case period_type
            when 'daily' then 1
            when 'weekly' then 2
            when 'monthly' then 3
          end,
          period_start desc
        limit 1
      ),
      100
    )::integer as base_target,
    round(
      coalesce(
        (
          select target_value
          from public.targets
          where user_id = auth.uid()
            and metric_key = 'points'
            and period_type in ('daily', 'weekly', 'monthly')
            and period_start <= p_date_local
          order by 
            case period_type
              when 'daily' then 1
              when 'weekly' then 2
              when 'monthly' then 3
            end,
            period_start desc
          limit 1
        ),
        100
      ) * 1.5
    )::integer as stretch_target,
    greatest(
      coalesce(
        (
          select sum(e.value * coalesce(oms.points_per_unit, 0))
          from public.activity_events e
          left join public.okr_metric_scores oms
            on oms.user_id = e.actor_user_id
            and oms.metric_key = e.metric_key
          where e.actor_user_id = auth.uid()
            and e.is_void = false
            and e.source = 'manual'
            and e.metadata->>'entry_source' = 'okr_daily'
            and (e.recorded_at at time zone 'America/Monterrey')::date = p_date_local
        ),
        0
      ) - coalesce(
        (
          select target_value
          from public.targets
          where user_id = auth.uid()
            and metric_key = 'points'
            and period_type in ('daily', 'weekly', 'monthly')
            and period_start <= p_date_local
          order by 
            case period_type
              when 'daily' then 1
              when 'weekly' then 2
              when 'monthly' then 3
            end,
            period_start desc
        limit 1
        ),
        100
      ),
      0
    )::integer as extra_points;
$$;

grant execute on function public.get_okr_points_progress(date) to authenticated;

-- ----------------------------
-- Actualizar vista okr_today_summary (solo okr_daily)
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
    and e.source = 'manual'
    and e.metadata->>'entry_source' = 'okr_daily'
    and e.recorded_at >= b.day_start
    and e.recorded_at < b.day_end
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
  and md.key not like 'pipeline.%'
order by md.sort_order;

grant select on public.okr_today_summary to authenticated;

-- ----------------------------
-- Actualizar vista okr_week_daily_summary (solo okr_daily)
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
where md.key not like 'pipeline.%'
left join active_rules ar on ar.metric_key = d.metric_key
order by d.day_local asc, md.sort_order asc;

grant select on public.okr_week_daily_summary to authenticated;

-- ----------------------------
-- Actualizar vista okr_week_metric_totals (solo okr_daily)
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
    and e.source = 'manual'
    and e.metadata->>'entry_source' = 'okr_daily'
    and e.recorded_at >= b.week_start
    and e.recorded_at < b.week_end
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
  and md.key not like 'pipeline.%'
order by md.sort_order;

grant select on public.okr_week_metric_totals to authenticated;

commit;
