create or replace function public.upsert_daily_metrics(p_date_local date, p_entries jsonb)
returns void
language plpgsql
security definer
as $function$
declare
  v_uid uuid := auth.uid();
  v_midday timestamptz;
  v_batch_key text;
  v_today_local date;
  v_missing_keys text[];
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_date_local is null then
    raise exception 'p_date_local is required';
  end if;

  if p_entries is null or jsonb_typeof(p_entries) <> 'array' then
    raise exception 'p_entries must be a jsonb array';
  end if;

  -- Fecha hoy local
  v_today_local := (now() at time zone 'America/Monterrey')::date;

  -- Usamos “mediodía local” como timestamp canónico del día capturado
  v_midday := ((p_date_local::text || ' 12:00:00')::timestamp at time zone 'America/Monterrey');
  v_batch_key := 'manual-batch:' || v_uid::text || ':' || p_date_local::text || ':' || to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS');

  /*
    1) Normalizar keys del payload (trim + lower)
    2) Validar contra metric_definitions.key ANTES de insertar/void
  */
  with payload_keys as (
    select distinct lower(btrim(x->>'metric_key')) as metric_key
    from jsonb_array_elements(p_entries) x
    where coalesce(nullif(btrim(x->>'metric_key'),''), '') <> ''
  ),
  missing as (
    select pk.metric_key
    from payload_keys pk
    left join public.metric_definitions md
      on md.key = pk.metric_key
    where md.key is null
  )
  select array_agg(metric_key order by metric_key)
    into v_missing_keys
  from missing;

  if v_missing_keys is not null then
    raise exception 'Unknown metric_key(s) in payload (not in metric_definitions): %', v_missing_keys;
  end if;

  -- VOID previos del día (solo manual y solo esas métricas) usando key normalizada
  update public.activity_events e
     set is_void = true,
         void_reason = 'replaced_by_manual_bulk',
         voided_at = now(),
         voided_by = v_uid
   where e.actor_user_id = v_uid
     and e.is_void = false
     and e.source = 'manual'
     and (e.recorded_at at time zone 'America/Monterrey')::date = p_date_local
     and e.metric_key in (
       select distinct lower(btrim(x->>'metric_key'))
       from jsonb_array_elements(p_entries) x
       where coalesce(nullif(btrim(x->>'metric_key'),''), '') <> ''
     );

  -- INSERT nuevos (idempotency_key SIEMPRE único)
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
    lower(btrim(x->>'metric_key'))::text,
    coalesce(nullif(x->>'value','')::int, 0),
    v_midday,
    v_midday,
    'manual',
    ('manual:' || gen_random_uuid()::text),
    jsonb_build_object(
      'entry_source', 'okr_daily',
      'date_local', p_date_local::text,
      'captured_local', v_today_local::text,
      'batch_key', v_batch_key
    )
  from jsonb_array_elements(p_entries) x
  where coalesce(nullif(btrim(x->>'metric_key'),''), '') <> ''
    and coalesce(nullif(x->>'value','')::int, 0) > 0;

end;
$function$;
