-- move_lead_stage: permitir movimiento bidireccional entre etapas activas.
-- No existe restricción por position ni por dirección del movimiento.
-- Se permite mover hacia adelante o hacia atrás a cualquier etapa activa distinta de la actual.

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
  v_to_slug text;
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

  -- validar etapa destino: debe existir, estar activa. Cualquier etapa activa (bidireccional).
  select s.slug into v_to_slug
  from public.pipeline_stages s
  where s.id = p_to_stage_id
    and s.is_active = true;

  if not found then
    raise exception 'Etapa destino inválida';
  end if;

  -- no-op si mismo destino (evitar historial redundante)
  if p_to_stage_id = v_from_stage_id then
    return query
    select p_lead_id, v_from_stage_id, p_to_stage_id, v_now;
    return;
  end if;

  -- history: occurred_at = fecha real del evento; si no se pasa, usar moved_at
  insert into public.lead_stage_history(
    lead_id, from_stage_id, to_stage_id, moved_by, moved_at, idempotency_key, occurred_at
  ) values (
    p_lead_id, v_from_stage_id, p_to_stage_id, auth.uid(), v_now, p_idempotency_key,
    coalesce(p_occurred_at, v_now)
  );

  -- update lead: stage + timestamps cuando corresponda (no sobrescribir si ya tienen valor)
  update public.leads
  set
    stage_id = p_to_stage_id,
    stage_changed_at = v_now,
    cita_realizada_at = case
      when v_to_slug = 'casos_abiertos' and cita_realizada_at is null
      then coalesce(p_occurred_at, v_now)
      else cita_realizada_at
    end,
    propuesta_presentada_at = case
      when v_to_slug = 'citas_cierre' and propuesta_presentada_at is null
      then coalesce(p_occurred_at, v_now)
      else propuesta_presentada_at
    end,
    cerrado_at = case
      when v_to_slug = 'casos_ganados' and cerrado_at is null
      then coalesce(p_occurred_at, v_now)
      else cerrado_at
    end
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

comment on function public.move_lead_stage(uuid, uuid, text, timestamptz) is
  'Mueve un lead a otra etapa. Permite movimiento bidireccional (avanzar o retroceder) entre etapas activas.';

-- Permisos (re-aplicar por si acaso)
revoke all on function public.move_lead_stage(uuid, uuid, text, timestamptz) from public;
grant execute on function public.move_lead_stage(uuid, uuid, text, timestamptz) to authenticated;

commit;
