-- 20260109141000_rpc_get_okr_streak_with_grace.sql
-- RPC para calcular racha con tolerancia de 1 día

begin;

create or replace function public.get_okr_streak_with_grace()
returns table (
  streak_days integer,
  last_logged_date date,
  is_alive boolean,
  grace_days_left integer
)
language sql
security invoker
set search_path = public
stable
as $$
  with today_local as (
    select (now() at time zone 'America/Monterrey')::date as today
  ),
  logged_days as (
    select distinct
      (e.recorded_at at time zone 'America/Monterrey')::date as day_local
    from public.activity_events e
    where e.actor_user_id = auth.uid()
      and e.source = 'manual'
      and e.is_void = false
      and e.metadata->>'entry_source' = 'okr_daily'
    order by day_local desc
  ),
  last_logged as (
    select max(day_local) as last_date
    from logged_days
  ),
  grace_info as (
    select
      ll.last_date,
      t.today,
      case
        when ll.last_date is null then 0
        when ll.last_date = t.today then 1
        when ll.last_date = t.today - interval '1 day' then 0
        else 0
      end as grace_left,
      case
        when ll.last_date is null then false
        when ll.last_date >= t.today - interval '1 day' then true
        else false
      end as alive
    from last_logged ll
    cross join today_local t
  ),
  streak_calc as (
    select
      gi.last_date as last_logged_date,
      gi.alive as is_alive,
      gi.grace_left as grace_days_left,
      case
        when not gi.alive or gi.last_date is null then 0
        else (
          -- Contar días consecutivos hacia atrás desde last_logged_date
          with recursive streak_days as (
            -- Día base: last_logged_date
            select
              gi.last_date as check_date,
              1 as streak_count
            
            union all
            
            -- Día anterior si existe registro
            select
              sd.check_date - interval '1 day' as check_date,
              sd.streak_count + 1 as streak_count
            from streak_days sd
            where exists (
              select 1
              from logged_days ld
              where ld.day_local = sd.check_date - interval '1 day'
            )
          )
          select max(streak_count)
          from streak_days
        )
      end as streak_days
    from grace_info gi
  )
  select
    coalesce(sc.streak_days, 0)::integer as streak_days,
    sc.last_logged_date,
    coalesce(sc.is_alive, false) as is_alive,
    coalesce(sc.grace_days_left, 0)::integer as grace_days_left
  from streak_calc sc;
$$;

grant execute on function public.get_okr_streak_with_grace() to authenticated;

commit;
