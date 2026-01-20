-- ============================================================
-- MIGRATION: bootstrap_owner RPC
-- Proyecto: VANT-OS (single-agency)
--
-- Objetivo:
-- - Inicializar el owner del sistema de forma controlada
-- - Evitar bootstrap manual con triggers deshabilitados
-- - Permitir ejecución SOLO si:
--     a) No existe owner aún, o
--     b) El caller es el owner actual
-- ============================================================

create or replace function public.bootstrap_owner(p_owner uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Si ya existe owner global, solo el owner actual puede re-ejecutar
  if exists (select 1 from public.okr_settings_global) then
    if not exists (
      select 1
      from public.okr_settings_global g
      where g.owner_user_id = auth.uid()
    ) then
      raise exception 'Not authorized: owner already set';
    end if;
  end if;

  -- Crear / actualizar perfil como OWNER
  insert into public.profiles (user_id, role, created_at, updated_at)
  values (p_owner, 'owner', now(), now())
  on conflict (user_id) do update
  set role = 'owner',
      updated_at = now();

  -- Crear configuración global si no existe (single-agency)
  insert into public.okr_settings_global (
    owner_user_id,
    daily_expected_points,
    weekly_days,
    tiers,
    created_at,
    updated_at
  )
  select
    p_owner,
    25,
    5,
    '[
      {"name":"Bajo","min_points":0,"max_points":24},
      {"name":"Meta","min_points":25,"max_points":34},
      {"name":"Alto","min_points":35,"max_points":999}
    ]'::jsonb,
    now(),
    now()
  where not exists (select 1 from public.okr_settings_global);
end;
$$;

-- 🔒 Seguridad explícita
revoke all on function public.bootstrap_owner(uuid) from public;
grant execute on function public.bootstrap_owner(uuid) to authenticated;
