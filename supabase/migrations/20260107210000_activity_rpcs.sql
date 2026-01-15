-- 20260107210000_activity_rpcs.sql
-- RPCs for logging activity + undo last event registered today (America/Monterrey)

begin;

-- ----------------------------
-- 1) AUDIT LOG: allow inserts from any authenticated user (self-only)
-- ----------------------------
do $$ begin
  create policy "audit_log_insert_self"
  on public.audit_log
  for insert
  to authenticated
  with check (actor_user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- (Select remains admin-only from 001_init.sql)

-- ----------------------------
-- 2) Helper: start/end of "today" in America/Monterrey as timestamptz
-- ----------------------------
create or replace function public.day_bounds_monterrey(p_now timestamptz default now())
returns table(day_start timestamptz, day_end timestamptz)
language sql
stable
as $$
  select
    (date_trunc('day', (p_now at time zone 'America/Monterrey')) at time zone 'America/Monterrey') as day_start,
    ((date_trunc('day', (p_now at time zone 'America/Monterrey')) + interval '1 day') at time zone 'America/Monterrey') as day_end
$$;

-- ----------------------------
-- 3) RPC: log_activity_event
-- ----------------------------
create or replace function public.log_activity_event(
  p_metric_key text,
  p_value int default 1,
  p_happened_at timestamptz default now(),
  p_source text default 'manual',
  p_idempotency_key text default null,
  p_metadata jsonb default null
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_event_id uuid;
  v_metric_exists boolean;
  v_lead_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_metric_key is null or length(trim(p_metric_key)) = 0 then
    raise exception 'metric_key is required';
  end if;

  if p_value is null or p_value <= 0 then
    raise exception 'value must be > 0';
  end if;

  if p_source not in ('manual','pipeline','system') then
    raise exception 'invalid source: %', p_source;
  end if;

  select exists(
    select 1
    from public.metric_definitions md
    where md.key = p_metric_key
      and md.is_active = true
  ) into v_metric_exists;

  if not v_metric_exists then
    raise exception 'metric_key does not exist or is inactive: %', p_metric_key;
  end if;

  -- Extract lead_id from metadata if present (supports both string/uuid json)
  v_lead_id := null;
  if p_metadata is not null and p_metadata ? 'lead_id' then
    begin
      v_lead_id := nullif(p_metadata->>'lead_id','')::uuid;
    exception when others then
      v_lead_id := null;
    end;
  end if;

  begin
    insert into public.activity_events (
      actor_user_id,
      metric_key,
      value,
      happened_at,
      source,
      idempotency_key,
      metadata,
      lead_id
    )
    values (
      auth.uid(),
      p_metric_key,
      p_value,
      p_happened_at,
      p_source,
      p_idempotency_key,
      p_metadata,
      v_lead_id
    )
    returning id into v_event_id;

  exception
    when unique_violation then
      -- If idempotency_key is duplicated, return the existing event id
      if p_idempotency_key is null then
        raise;
      end if;

      select id into v_event_id
      from public.activity_events
      where idempotency_key = p_idempotency_key
      limit 1;

      if v_event_id is null then
        raise;
      end if;
  end;

  -- Optional audit (safe now due to policy)
  insert into public.audit_log (actor_user_id, action, entity, entity_id, before, after)
  values (
    auth.uid(),
    'LOG_ACTIVITY_EVENT',
    'activity_events',
    v_event_id::text,
    null,
    jsonb_build_object(
      'metric_key', p_metric_key,
      'value', p_value,
      'happened_at', p_happened_at,
      'source', p_source,
      'idempotency_key', p_idempotency_key
    )
  );

  return v_event_id;
end;
$$;

-- ----------------------------
-- 4) RPC: void_last_event_today (UNDO)
-- "today" is based on recorded_at in America/Monterrey
-- ----------------------------
create or replace function public.void_last_event_today(
  p_reason text default 'undo'
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_day_start timestamptz;
  v_day_end timestamptz;
  v_event_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select day_start, day_end
  into v_day_start, v_day_end
  from public.day_bounds_monterrey(now());

  -- Find last event registered today (recorded_at window), not voided
  select id into v_event_id
  from public.activity_events
  where actor_user_id = auth.uid()
    and is_void = false
    and recorded_at >= v_day_start
    and recorded_at < v_day_end
  order by recorded_at desc
  limit 1;

  if v_event_id is null then
    raise exception 'No events to undo today';
  end if;

  update public.activity_events
  set
    is_void = true,
    void_reason = coalesce(nullif(trim(p_reason), ''), 'undo'),
    voided_at = now(),
    voided_by = auth.uid()
  where id = v_event_id;

  insert into public.audit_log (actor_user_id, action, entity, entity_id, before, after)
  values (
    auth.uid(),
    'VOID_LAST_EVENT_TODAY',
    'activity_events',
    v_event_id::text,
    null,
    jsonb_build_object('reason', p_reason)
  );

  return v_event_id;
end;
$$;

commit;
