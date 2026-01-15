-- 20260107214500_okr_streak_view.sql
-- Streak summary for current user (America/Monterrey)

begin;

create or replace view public.okr_streak_summary
with (security_invoker = true)
as
with days as (
  select distinct (e.happened_at at time zone 'America/Monterrey')::date as day_local
  from public.activity_events e
  where e.actor_user_id = auth.uid()
    and e.is_void = false
),
today as (
  select (now() at time zone 'America/Monterrey')::date as today_local
),
walkback as (
  -- scan back up to 365 days; streak ends at first gap
  select (today_local - offs)::date as d
  from today, generate_series(0, 365) as offs
),
marked as (
  select w.d, (d.day_local is not null) as has_activity
  from walkback w
  left join days d on d.day_local = w.d
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
