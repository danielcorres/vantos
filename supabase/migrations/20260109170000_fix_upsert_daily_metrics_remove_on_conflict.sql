-- 20260109170000_fix_upsert_daily_metrics_remove_on_conflict.sql
-- Eliminar ON CONFLICT y usar VOID + INSERT con idempotency_key único

begin;

create extension if not exists "pgcrypto";

create or replace function public.upsert_daily_metrics(
  p_date_local date,
  p_entries jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid;
  v_today_local date;
  v_midday timestamptz;
  v_batch_key text;
begin
  v_uid := auth.uid();
  
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_date_local is null then
    raise exception 'p_date_local is required';
  end if;

  if p_entries is null or jsonb_typeof(p_entries) <> 'array' then
    raise exception 'p_entries must be a jsonb array';
  end if;

  -- Calcular fecha de captura (hoy en America/Monterrey)
  v_today_local := (now() at time zone 'America/Monterrey')::date;
  
  -- "Mediodía" local Monterrey para evitar DST issues
  v_midday := ((p_date_local::text || ' 12:00:00')::timestamp at time zone 'America/Monterrey');
  
  -- Generar batch_key único
  v_batch_key := 'manual-batch:' || v_uid::text || ':' || p_date_local::text || ':' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');

  -- A) VOID previos (antes del insert)
  update public.activity_events
  set
    is_void = true,
    void_reason = 'replaced_by_manual_bulk',
    voided_at = now(),
    voided_by = v_uid
  where actor_user_id = v_uid
    and source = 'manual'
    and is_void = false
    and (recorded_at at time zone 'America/Monterrey')::date = p_date_local
    and metric_key in (
      select (x->>'metric_key')::text
      from jsonb_array_elements(p_entries) x
      where coalesce(nullif(x->>'metric_key', ''), '') <> ''
    )
    and (metadata->>'entry_source' = 'okr_daily' or metadata is null);

  -- B) INSERT nuevos (sin ON CONFLICT)
  insert into public.activity_events (
    actor_user_id,
    metric_key,
    value,
    happened_at,
    recorded_at,
    source,
    idempotency_key,
    metadata
  )
  select
    v_uid,
    (x->>'metric_key')::text,
    (x->>'value')::int,
    v_midday,
    v_midday,
    'manual',
    'manual:' || gen_random_uuid()::text,
    jsonb_build_object(
      'entry_source', 'okr_daily',
      'date_local', p_date_local::text,
      'captured_local', v_today_local::text,
      'batch_key', v_batch_key
    )
  from jsonb_array_elements(p_entries) x
  where coalesce(nullif(x->>'metric_key', ''), '') <> ''
    and coalesce((x->>'value')::int, 0) > 0;

end;
$$;

grant execute on function public.upsert_daily_metrics(date, jsonb) to authenticated;

commit;
