-- 20260109132000_view_okr_points_progress_by_date.sql
-- Vista y RPC para leer progreso de puntos por fecha

begin;

-- Vista para hoy (puede usarse directamente)
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

-- RPC para cualquier fecha
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

commit;
