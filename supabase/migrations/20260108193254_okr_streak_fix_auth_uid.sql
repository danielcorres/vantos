create or replace view public.okr_streak_summary as
with base as (
  select (now() at time zone 'America/Monterrey')::date as today_local
),
days_with_activity as (
  select distinct (e.recorded_at at time zone 'America/Monterrey')::date as day_local
  from public.activity_events e
  where e.actor_user_id = auth.uid()
    and e.is_void = false
),
flags as (
  select
    b.today_local,
    exists (select 1 from days_with_activity d where d.day_local = b.today_local) as has_today,
    exists (select 1 from days_with_activity d where d.day_local = (b.today_local - 1)) as has_yesterday
  from base b
),
anchor as (
  select
    today_local,
    case
      when has_today then today_local
      when has_yesterday then (today_local - 1)
      else null
    end as anchor_day
  from flags
),
walkback as (
  select (a.anchor_day - offs)::date as d
  from anchor a
  join lateral generate_series(0, 365) as offs on a.anchor_day is not null
),
marked as (
  select
    w.d,
    (dwa.day_local is not null) as has_activity
  from walkback w
  left join days_with_activity dwa on dwa.day_local = w.d
  order by w.d desc
),
streak as (
  select coalesce(count(*), 0)::int as streak_days
  from (
    select
      m.d,
      m.has_activity,
      sum(case when m.has_activity then 0 else 1 end) over (order by m.d desc) as breaks
    from marked m
  ) x
  where x.breaks = 0
    and x.has_activity = true
)
select
  case when (select anchor_day from anchor) is null then 0 else (select streak_days from streak) end as streak_days;
