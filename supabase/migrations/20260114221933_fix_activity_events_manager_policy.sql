-- ============================================================
-- FIX: Simplify manager_can_select_team_activity_events policy
-- ============================================================

drop policy if exists manager_can_select_team_activity_events
on public.activity_events;

create policy manager_can_select_team_activity_events
on public.activity_events
for select
to authenticated
using (
  public.is_manager()
  and actor_user_id in (
    select p.user_id
    from public.profiles p
    where p.role = 'advisor'
      and p.manager_user_id = auth.uid()
  )
);
