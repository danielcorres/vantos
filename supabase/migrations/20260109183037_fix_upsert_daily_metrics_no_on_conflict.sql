-- 20260109134500_fix_upsert_daily_metrics_no_on_conflict.sql
create or replace function public.upsert_daily_metrics(
  p_date_local date,
  p_entries jsonb
) returns void
language plpgsql
security invoker
as $$
declare
  v_uid uuid := auth.uid();
  v_midday timestamptz;
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

  -- "Mediodía" local Monterrey para evitar DST issues
  v_midday := ((p_date_local::text || ' 12:00:00')::timestamp at time zone 'America/Monterrey');

  -- VOID previos del mismo día/usuario/source/manual y métricas incluidas
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
       select (x->>'metric_key')::text
       from jsonb_array_elements(p_entries) x
       where coalesce(nullif(x->>'metric_key',''), '') <> ''
     );

  -- INSERT nuevos (sin ON CONFLICT)
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
    ('manual:' || v_uid::text || ':' || p_date_local::text || ':' || (x->>'metric_key')::text),
    jsonb_build_object('date_local', p_date_local::text, 'entry_source', 'okr_daily')
  from jsonb_array_elements(p_entries) x
  where coalesce(nullif(x->>'metric_key',''), '') <> ''
    and coalesce((x->>'value')::int, 0) > 0;

end;
$$;

grant execute on function public.upsert_daily_metrics(date, jsonb) to authenticated;
