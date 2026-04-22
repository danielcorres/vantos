-- Quitar métricas duplicadas del catálogo OKR; pipeline registra en calls / meetings_held

begin;

-- 1) Ocultar en UI (Okr* filtran is_active = true)
update public.metric_definitions
set is_active = false
where key in ('contacts_made', 'meetings_done');

-- 2) Puntos por unidad huérfanos en scoring
delete from public.okr_metric_scores
where metric_key in ('contacts_made', 'meetings_done');

-- 3) RPC: contact -> calls, meeting -> meetings_held
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

  case p_action_type
    when 'contact' then v_metric_key := 'calls';
    when 'meeting' then v_metric_key := 'meetings_held';
    else raise exception 'p_action_type must be ''contact'' or ''meeting'', got: %', p_action_type;
  end case;

  if not exists (
    select 1 from public.metric_definitions
    where key = v_metric_key and is_active = true
  ) then
    raise exception 'metric_key % does not exist or is inactive', v_metric_key;
  end if;

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

commit;
