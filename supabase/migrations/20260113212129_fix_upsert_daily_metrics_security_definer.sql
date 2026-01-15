-- FIX: upsert_daily_metrics debe ser SECURITY DEFINER para evitar bloqueo por RLS
-- 
-- PROBLEMA:
-- El RPC upsert_daily_metrics hace UPDATE + INSERT en activity_events.
-- Como RLS está activo en activity_events, el RPC falla con 403 Forbidden
-- porque RLS evalúa las políticas usando el rol del usuario que llama al RPC,
-- no el rol del propietario de la función.
--
-- SOLUCIÓN:
-- Convertir la función a SECURITY DEFINER para que ejecute con los permisos
-- del propietario (postgres), evitando las restricciones de RLS.
-- Además, endurecer permisos: solo authenticated y service_role pueden ejecutar.

begin;

-- Convertir a SECURITY DEFINER
alter function public.upsert_daily_metrics(date, jsonb)
  security definer;

-- Asegurar que el owner es postgres (por si acaso)
alter function public.upsert_daily_metrics(date, jsonb)
  owner to postgres;

-- Revocar permisos de anon y public (si existen)
revoke execute on function public.upsert_daily_metrics(date, jsonb) from anon;
revoke execute on function public.upsert_daily_metrics(date, jsonb) from public;

-- Otorgar permisos solo a authenticated y service_role
grant execute on function public.upsert_daily_metrics(date, jsonb) to authenticated;
grant execute on function public.upsert_daily_metrics(date, jsonb) to service_role;

commit;

-- VALIDACIÓN:
-- 1) Verificar que la función existe y es SECURITY DEFINER:
--    select proname, prosecdef, proowner::regrole
--    from pg_proc
--    where proname = 'upsert_daily_metrics';
--    Debe mostrar: prosecdef = true, proowner = postgres
--
-- 2) Probar guardar en OkrDailyLogPage:
--    - Abrir /okr/daily
--    - Agregar una métrica (ej. calls: 5)
--    - Guardar
--    - Verificar en Network tab: POST /rest/v1/rpc/upsert_daily_metrics debe retornar 200 OK
--    - Verificar que no aparece error 403 Forbidden
