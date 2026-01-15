-- 20260107224500_fix_streak_logic.sql
-- Fix streak: show yesterday's streak if today has no activity yet; when today logs, it increments.

begin;

create or replace view public.okr_streak_summary
with (security_invoker = true)
as
with base as (
  select
    (now() at time zone 'America/Monterrey')::date as today_local
),
days_with_activity as (
  select distinct (e.happened_at at time zone 'America/Monterrey')::date as day_local
  from public.activity_events e
  where e.actor_user_id = auth.uid()
    and e.is_void = false
),
flags as (
  select
    b.today_local,
    exists (
      select 1 from days_with_activity d
      where d.day_local = b.today_local
    ) as has_today
  from base b
),
anchor as (
  -- If today has activity, anchor at today; else anchor at yesterday
  select
    today_local,
    (case when has_today then today_local else (today_local - 1) end) as anchor_day
  from flags
),
walkback as (
  select (a.anchor_day - offs)::date as d
  from anchor a, generate_series(0, 365) as offs
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
  select count(*)::int as streak_days
  from (
    select *,
      sum(case when has_activity then 0 else 1 end) over (order by d desc) as breaks
    from marked
  ) x
  where breaks = 0 and has_activity = true
)
select streak_days from streak;

grant select on public.okr_streak_summary to authenticated;

commit;
