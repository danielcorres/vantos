create extension if not exists "pgcrypto";

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
  cross join today_local t
  where e.actor_user_id = auth.uid()
    and e.source = 'manual'
    and e.is_void = false
    and e.metadata->>'entry_source' = 'okr_daily'
    -- Validación: solo contar días válidos (no backfill)
    and (
      -- Si tiene captured_local: debe ser capturado a más tardar en day_local + 1
      (
        e.metadata->>'captured_local' is not null
        and (e.metadata->>'captured_local')::date <= (e.recorded_at at time zone 'America/Monterrey')::date + interval '1 day'
      )
      -- Si NO tiene captured_local (registros viejos): solo permitir hoy o ayer
      or (
        e.metadata->>'captured_local' is null
        and (e.recorded_at at time zone 'America/Monterrey')::date in (t.today, t.today - interval '1 day')
      )
    )
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
      when ll.last_date = (t.today - 1) then 0
      else 0
    end as grace_left,
    case
      when ll.last_date is null then false
      when ll.last_date >= (t.today - 1) then true
      else false
    end as alive
  from last_logged ll
  cross join today_local t
),
streak_days_cte as (
  with recursive s as (
    select gi.last_date as day_local
    from grace_info gi
    where gi.alive = true and gi.last_date is not null

    union all

    select (s.day_local - 1) as day_local
    from s
    join logged_days ld on ld.day_local = (s.day_local - 1)
  )
  select count(*)::int as streak_count
  from s
)
select
  case
    when gi.alive = false or gi.last_date is null then 0
    else sd.streak_count
  end as streak_days,
  gi.last_date as last_logged_date,
  gi.alive as is_alive,
  gi.grace_left as grace_days_left
from grace_info gi
cross join streak_days_cte sd;
$$;

grant execute on function public.get_okr_streak_with_grace() to authenticated;
