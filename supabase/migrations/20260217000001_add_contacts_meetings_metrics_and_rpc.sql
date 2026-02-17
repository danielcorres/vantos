-- Añadir métricas contacts_made y meetings_done para "completar próximo paso"
-- RPC log_next_action_completion para registrar 1 en la métrica correspondiente

begin;

-- 1) Seed metric_definitions si no existen
insert into public.metric_definitions (key, label, unit, is_active, sort_order)
values
  ('contacts_made',  'Contactos realizados', 'count', true, 11),
  ('meetings_done',  'Reuniones realizadas',  'count', true, 31)
on conflict (key) do update
set
  label = excluded.label,
  unit = excluded.unit,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

-- 2) RPC log_next_action_completion: registra 1 en contacts_made o meetings_done
create or replace function public.log_next_action_completion(
  p_lead_id uuid,
  p_action_type text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_metric_key text;
  v_today_local date;
  v_midday timestamptz;
  v_uid uuid := auth.uid();
  v_idempotency text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_lead_id is null then
    raise exception 'p_lead_id is required';
  end if;

  p_action_type := lower(trim(p_action_type));

  -- Mapear action_type a metric_key
  case p_action_type
    when 'contact' then v_metric_key := 'contacts_made';
    when 'meeting' then v_metric_key := 'meetings_done';
    else raise exception 'p_action_type must be ''contact'' or ''meeting'', got: %', p_action_type;
  end case;

  -- Validar que la métrica existe
  if not exists (
    select 1 from public.metric_definitions
    where key = v_metric_key and is_active = true
  ) then
    raise exception 'metric_key % does not exist or is inactive', v_metric_key;
  end if;

  -- Fecha local Monterrey para today
  v_today_local := (now() at time zone 'America/Monterrey')::date;
  v_midday := ((v_today_local::text || ' 12:00:00')::timestamp at time zone 'America/Monterrey');
  v_idempotency := 'next_action_complete:' || v_uid::text || ':' || p_lead_id::text || ':' || v_today_local::text;

  insert into public.activity_events (
    actor_user_id,
    metric_key,
    value,
    happened_at,
    recorded_at,
    source,
    idempotency_key,
    metadata,
    lead_id
  )
  values (
    v_uid,
    v_metric_key,
    1,
    v_midday,
    v_midday,
    'pipeline',
    v_idempotency,
    jsonb_build_object('entry_source', 'next_action_completion', 'lead_id', p_lead_id::text),
    p_lead_id
  )
  on conflict (idempotency_key) where (idempotency_key is not null) do nothing;
end;
$function$;

grant execute on function public.log_next_action_completion(uuid, text) to authenticated;
grant execute on function public.log_next_action_completion(uuid, text) to service_role;

commit;
