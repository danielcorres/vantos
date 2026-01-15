-- ===============================
-- RLS: Manager puede leer su equipo
-- ===============================

-- Asegurar RLS activo
alter table public.profiles enable row level security;
alter table public.activity_events enable row level security;

-- ===============================
-- PROFILES
-- ===============================

-- Manager puede verse a sí mismo
drop policy if exists "manager_can_select_self" on public.profiles;
create policy "manager_can_select_self"
on public.profiles
for select
to authenticated
using (
  user_id = auth.uid()
);

-- Manager puede leer a sus advisors
drop policy if exists "manager_can_select_team_advisors" on public.profiles;
create policy "manager_can_select_team_advisors"
on public.profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.user_id = auth.uid()
      and me.role = 'manager'
  )
  and role = 'advisor'
  and manager_user_id = auth.uid()
);

-- ===============================
-- ACTIVITY_EVENTS
-- ===============================

-- Manager puede leer eventos de sus advisors
drop policy if exists "manager_can_select_team_activity_events" on public.activity_events;
create policy "manager_can_select_team_activity_events"
on public.activity_events
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles me
    where me.user_id = auth.uid()
      and me.role = 'manager'
  )
  and actor_user_id in (
    select p.user_id
    from public.profiles p
    where p.role = 'advisor'
      and p.manager_user_id = auth.uid()
  )
);
