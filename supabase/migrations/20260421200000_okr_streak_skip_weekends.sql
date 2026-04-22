-- Racha OKR: sábado y domingo no exigen registro (America/Monterrey).
-- is_alive: no puede haber un día laboral (lun–vie) sin log entre last_date y hoy.
-- Cadena recursiva: salta fines de semana al buscar el día con log anterior en la racha.

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
    cross join today_local t
    where e.actor_user_id = auth.uid()
      and e.source = 'manual'
      and e.is_void = false
      and e.metadata->>'entry_source' = 'okr_daily'
      and (
        (
          e.metadata->>'captured_local' is not null
          and (e.metadata->>'captured_local')::date <= (e.recorded_at at time zone 'America/Monterrey')::date + interval '1 day'
        )
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
        else 0
      end as grace_left,
      case
        when ll.last_date is null then false
        when not exists (
          select 1
          from generate_series(
            ll.last_date + 1,
            t.today - 1,
            interval '1 day'
          ) as gs(d)
          where extract(dow from gs.d) between 1 and 5
            and not exists (
              select 1 from logged_days ld where ld.day_local = gs.d
            )
        ) then true
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

      select pl.prev_logged as day_local
      from s
      cross join lateral (
        select max(ld2.day_local) as prev_logged
        from logged_days ld2
        where ld2.day_local < s.day_local
          and not exists (
            select 1
            from generate_series(
              ld2.day_local + 1,
              s.day_local - 1,
              interval '1 day'
            ) as gap(d)
            where extract(dow from gap.d) between 1 and 5
              and not exists (
                select 1 from logged_days z where z.day_local = gap.d
              )
          )
      ) pl
      where pl.prev_logged is not null
    )
    select count(*)::int as streak_count
    from s
  )
  select
    case
      when gi.alive = false or gi.last_date is null then 0
      else coalesce(sd.streak_count, 0)
    end as streak_days,
    gi.last_date as last_logged_date,
    coalesce(gi.alive, false) as is_alive,
    gi.grace_left as grace_days_left
  from grace_info gi
  cross join streak_days_cte sd;
$$;

grant execute on function public.get_okr_streak_with_grace() to authenticated;

commit;
