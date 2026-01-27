-- move_lead_stage: aceptar p_occurred_at opcional para hitos (fecha real del evento).
-- Al insertar en lead_stage_history: occurred_at = coalesce(p_occurred_at, moved_at).

begin;

create or replace function public.move_lead_stage(
  p_lead_id uuid,
  p_to_stage_id uuid,
  p_idempotency_key text,
  p_occurred_at timestamptz default null
)
returns table(
  lead_id uuid,
  from_stage_id uuid,
  to_stage_id uuid,
  moved_at timestamp with time zone
)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_from_stage_id uuid;
  v_now timestamptz := now();
  v_event_id uuid;
begin
  -- idempotency (por moved_by + key)
  if exists (
    select 1
    from public.lead_stage_history h
    where h.moved_by = auth.uid()
      and h.idempotency_key = p_idempotency_key
  ) then
    return query
    select h.lead_id, h.from_stage_id, h.to_stage_id, h.moved_at
    from public.lead_stage_history h
    where h.moved_by = auth.uid()
      and h.idempotency_key = p_idempotency_key
    limit 1;
    return;
  end if;

  -- lock lead y validar ownership
  select l.stage_id
    into v_from_stage_id
  from public.leads l
  where l.id = p_lead_id
    and l.owner_user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Lead no encontrado o sin acceso';
  end if;

  -- validar etapa destino (global)
  if not exists (
    select 1
    from public.pipeline_stages s
    where s.id = p_to_stage_id
      and s.is_active = true
  ) then
    raise exception 'Etapa destino inválida';
  end if;

  -- history: occurred_at = fecha real del evento; si no se pasa, usar moved_at
  insert into public.lead_stage_history(
    lead_id, from_stage_id, to_stage_id, moved_by, moved_at, idempotency_key, occurred_at
  ) values (
    p_lead_id, v_from_stage_id, p_to_stage_id, auth.uid(), v_now, p_idempotency_key,
    coalesce(p_occurred_at, v_now)
  );

  -- update lead
  update public.leads
  set stage_id = p_to_stage_id,
      stage_changed_at = v_now
  where id = p_lead_id
    and owner_user_id = auth.uid();

  -- AUTolog activity (tolerante: no rompe el move si falla)
  begin
    v_event_id := public.log_activity_event(
      'pipeline.stage_moved',
      1,
      v_now,
      'pipeline',
      p_idempotency_key,
      jsonb_build_object(
        'lead_id', p_lead_id::text,
        'from_stage_id', v_from_stage_id::text,
        'to_stage_id', p_to_stage_id::text
      )
    );
  exception
    when others then
      v_event_id := null;
  end;

  return query
  select p_lead_id, v_from_stage_id, p_to_stage_id, v_now;
end;
$function$;

-- Permisos: la firma (uuid,uuid,text,timestamptz) con default permite llamadas con 3 args
revoke all on function public.move_lead_stage(uuid, uuid, text, timestamptz) from public;
grant execute on function public.move_lead_stage(uuid, uuid, text, timestamptz) to authenticated;

commit;
