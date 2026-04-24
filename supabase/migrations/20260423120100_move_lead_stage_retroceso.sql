-- move_lead_stage: p_only_forward (calendario), is_retroceso en retrocesos y anulación de entrada forward de la semana.

begin;

drop function if exists public.move_lead_stage(uuid, uuid, text, timestamptz);

create or replace function public.move_lead_stage(
  p_lead_id uuid,
  p_to_stage_id uuid,
  p_idempotency_key text,
  p_occurred_at timestamptz default null,
  p_only_forward boolean default false
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
  v_from_position int;
  v_to_position int;
  v_is_backward boolean;
  v_week_start date;
begin
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

  select l.stage_id
    into v_from_stage_id
  from public.leads l
  where l.id = p_lead_id
    and l.owner_user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Lead no encontrado o sin acceso';
  end if;

  select s.slug, s.position into v_to_slug, v_to_position
  from public.pipeline_stages s
  where s.id = p_to_stage_id
    and s.is_active = true;

  if not found then
    raise exception 'Etapa destino inválida';
  end if;

  select s.position into v_from_position
  from public.pipeline_stages s
  where s.id = v_from_stage_id
    and s.is_active = true;

  if v_from_position is null then
    v_from_position := -1;
  end if;

  v_is_backward := v_to_position < v_from_position;

  if p_to_stage_id = v_from_stage_id then
    return query
    select p_lead_id, v_from_stage_id, p_to_stage_id, v_now;
    return;
  end if;

  if v_is_backward and p_only_forward then
    return query
    select p_lead_id, v_from_stage_id, v_from_stage_id, v_now;
    return;
  end if;

  v_week_start := (
    (v_now at time zone 'America/Monterrey')::date
    - ((extract(dow from (v_now at time zone 'America/Monterrey')::date)::int + 6) % 7)
  )::date;

  if v_is_backward then
    update public.lead_stage_history h
    set is_retroceso = true
    where h.id = (
      select h2.id
      from public.lead_stage_history h2
      where h2.lead_id = p_lead_id
        and h2.to_stage_id = v_from_stage_id
        and coalesce(h2.is_retroceso, false) = false
        and (coalesce(h2.occurred_at, h2.moved_at) at time zone 'America/Monterrey')::date >= v_week_start
        and (coalesce(h2.occurred_at, h2.moved_at) at time zone 'America/Monterrey')::date < v_week_start + 7
      order by coalesce(h2.occurred_at, h2.moved_at) desc
      limit 1
    );
  end if;

  insert into public.lead_stage_history(
    lead_id, from_stage_id, to_stage_id, moved_by, moved_at, idempotency_key, occurred_at, is_retroceso
  ) values (
    p_lead_id, v_from_stage_id, p_to_stage_id, auth.uid(), v_now, p_idempotency_key,
    coalesce(p_occurred_at, v_now),
    v_is_backward
  );

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
        'to_stage_id', p_to_stage_id::text,
        'is_retroceso', v_is_backward
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

comment on function public.move_lead_stage(uuid, uuid, text, timestamptz, boolean) is
  'Mueve un lead entre etapas activas. Retrocesos marcan is_retroceso y anulan la entrada forward de la semana a la etapa actual. p_only_forward evita retrocesos (p. ej. calendario).';

revoke all on function public.move_lead_stage(uuid, uuid, text, timestamptz, boolean) from public;
grant execute on function public.move_lead_stage(uuid, uuid, text, timestamptz, boolean) to authenticated;

commit;
