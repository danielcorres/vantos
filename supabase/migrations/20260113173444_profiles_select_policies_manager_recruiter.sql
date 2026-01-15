-- PROFILES: Políticas SELECT para managers, recruiters y owner (sin recursión)
-- Reemplaza políticas existentes que pueden tener recursión o no cubrir todos los casos

begin;

-- Asegurar RLS activo
alter table public.profiles enable row level security;

-- Eliminar políticas SELECT existentes para reemplazarlas
drop policy if exists "profiles_select_self" on public.profiles;
drop policy if exists "profiles_select_self_or_admin" on public.profiles;
drop policy if exists "profiles_select_manager_team" on public.profiles;
drop policy if exists "profiles_select_recruiter_team" on public.profiles;
drop policy if exists "profiles_select_owner_all" on public.profiles;
drop policy if exists "manager_can_select_self" on public.profiles;
drop policy if exists "manager_can_select_team_advisors" on public.profiles;

-- Policy 1: Self (cualquier usuario puede leer su propio perfil)
create policy "profiles_select_self"
on public.profiles
for select
to authenticated
using (user_id = auth.uid());

-- Policy 2: Managers pueden leer advisors de su equipo
-- SIN recursión: no consulta profiles para verificar si es manager
create policy "profiles_select_manager_team"
on public.profiles
for select
to authenticated
using (
  role = 'advisor'
  and manager_user_id = auth.uid()
);

-- Policy 3: Recruiters pueden leer advisors que reclutaron
-- SIN recursión: no consulta profiles para verificar si es recruiter
create policy "profiles_select_recruiter_team"
on public.profiles
for select
to authenticated
using (
  role = 'advisor'
  and recruiter_user_id = auth.uid()
);

-- Policy 4: Owner puede leer todos los perfiles
-- SIN recursión: usa okr_settings_global en lugar de consultar profiles
create policy "profiles_select_owner_all"
on public.profiles
for select
to authenticated
using (
  auth.uid() = (select owner_user_id from public.okr_settings_global limit 1)
);

commit;
