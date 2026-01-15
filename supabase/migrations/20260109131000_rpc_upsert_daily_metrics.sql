-- 20260109131000_rpc_upsert_daily_metrics.sql
-- RPC para bulk upsert de métricas diarias (hoy o pasada)

begin;

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
  v_user_id uuid;
  v_entry jsonb;
  v_metric_key text;
  v_value integer;
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_recorded_at timestamptz;
  v_idempotency_key text;
  v_metadata jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_user_id := auth.uid();

  -- Validar p_entries es un array
  if jsonb_typeof(p_entries) != 'array' then
    raise exception 'p_entries must be a JSON array';
  end if;

  -- Calcular bounds del día en America/Monterrey
  v_day_start := (date_trunc('day', (p_date_local::timestamp at time zone 'America/Monterrey')) at time zone 'America/Monterrey');
  v_day_end := v_day_start + interval '1 day';
  
  -- recorded_at será mediodía del día local en Monterrey
  v_recorded_at := v_day_start + interval '12 hours';

  -- Para cada entrada, validar y procesar
  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    -- Validar estructura
    if jsonb_typeof(v_entry->'metric_key') != 'string' or jsonb_typeof(v_entry->'value') != 'number' then
      raise exception 'Each entry must have metric_key (string) and value (number)';
    end if;

    v_metric_key := v_entry->>'metric_key';
    v_value := (v_entry->>'value')::integer;

    -- Validar metric_key no vacío
    if v_metric_key is null or length(trim(v_metric_key)) = 0 then
      raise exception 'metric_key cannot be empty';
    end if;

    -- Validar value >= 0
    if v_value is null or v_value < 0 then
      raise exception 'value must be >= 0 for metric_key: %', v_metric_key;
    end if;

    -- Verificar que la métrica existe y está activa
    if not exists (
      select 1
      from public.metric_definitions md
      where md.key = v_metric_key
        and md.is_active = true
    ) then
      raise exception 'metric_key does not exist or is inactive: %', v_metric_key;
    end if;

    -- VOID todos los eventos existentes del usuario para este día, source='manual', y esta métrica
    update public.activity_events
    set
      is_void = true,
      void_reason = 'replaced_by_okr_daily',
      voided_at = now(),
      voided_by = v_user_id
    where actor_user_id = v_user_id
      and metric_key = v_metric_key
      and source = 'manual'
      and (recorded_at at time zone 'America/Monterrey')::date = p_date_local
      and is_void = false;

    -- INSERTAR solo si value > 0
    if v_value > 0 then
      v_idempotency_key := 'manual:' || v_user_id::text || ':' || p_date_local::text || ':' || v_metric_key;
      v_metadata := jsonb_build_object(
        'date_local', p_date_local::text,
        'entry_source', 'okr_daily'
      );

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
      values (
        v_user_id,
        v_metric_key,
        v_value,
        v_recorded_at,
        v_recorded_at,
        'manual',
        v_idempotency_key,
        v_metadata
      )
      on conflict (idempotency_key) do update
      set
        value = excluded.value,
        happened_at = excluded.happened_at,
        recorded_at = excluded.recorded_at,
        metadata = excluded.metadata,
        is_void = false,
        void_reason = null,
        voided_at = null,
        voided_by = null;
    end if;
  end loop;
end;
$$;

grant execute on function public.upsert_daily_metrics(date, jsonb) to authenticated;

commit;
