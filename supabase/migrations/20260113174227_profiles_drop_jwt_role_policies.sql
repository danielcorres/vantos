-- PROFILES: Eliminar políticas SELECT que dependen de jwt()->>'role' (custom claims no configurados)
-- Estas políticas causan problemas porque jwt()->>'role' no está disponible
-- Se mantienen las políticas basadas en auth.uid() y okr_settings_global

begin;

-- Eliminar políticas que usan jwt()->>'role'
drop policy if exists "manager_select_team_advisors" on public.profiles;
drop policy if exists "owner_select_all_profiles" on public.profiles;

-- Nota: Las políticas válidas que deben permanecer:
-- - profiles_select_self (user_id = auth.uid())
-- - profiles_select_manager_team (role='advisor' AND manager_user_id = auth.uid())
-- - profiles_select_recruiter_team (role='advisor' AND recruiter_user_id = auth.uid())
-- - profiles_select_owner_all (auth.uid() = okr_settings_global.owner_user_id)

commit;
