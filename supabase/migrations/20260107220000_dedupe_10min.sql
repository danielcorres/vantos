-- 20260107220000_dedupe_10min.sql
-- Dedupe for activity_events using 10-min buckets (America/Monterrey) when metadata.lead_id exists.

begin;

-- 1) Ensure idempotency_key has a unique index (ignore nulls)
create unique index if not exists activity_events_idempotency_key_uniq
on public.activity_events (idempotency_key)
where idempotency_key is not null;

-- 2) Helper: floor timestamp into 10-minute bucket in America/Monterrey
create or replace function public.bucket_10min_monterrey(p_ts timestamptz)
returns timestamptz
language sql
stable
as $$
  with local_ts as (
    select (p_ts at time zone 'America/Monterrey') as t
  ),
  floored as (
    select
      date_trunc('hour', t)
      + make_interval(mins => (floor(extract(minute from t)::numeric / 10) * 10)::int)
      as t10
    from local_ts
  )
  select (t10 at time zone 'America/Monterrey') from floored
$$;

-- 3) Helper: make deterministic idempotency key for lead-related events
create or replace function public.make_event_idempotency_key(
  p_user_id uuid,
  p_metric_key text,
  p_lead_id uuid,
  p_happened_at timestamptz
)
returns text
language sql
stable
as $$
  select
    'u:' || p_user_id::text ||
    '|m:' || p_metric_key ||
    '|l:' || p_lead_id::text ||
    '|t:' || to_char(public.bucket_10min_monterrey(p_happened_at), 'YYYY-MM-DD"T"HH24:MI"Z"')
$$;

-- 4) Update RPC: log_activity_event
-- If p_idempotency_key is null AND metadata.lead_id exists, compute idempotency key using 10-min bucket.
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
  v_final_idempotency text;
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
  if p_metadata ? 'lead_id' then
    begin
      v_lead_id := (p_metadata->>'lead_id')::uuid;
    exception when others then
      v_lead_id := null;
    end;
  end if;

  -- Compute deterministic idempotency key if lead_id exists and caller didn't provide one
  v_final_idempotency := p_idempotency_key;

  if v_final_idempotency is null and v_lead_id is not null then
    v_final_idempotency :=
      public.make_event_idempotency_key(auth.uid(), p_metric_key, v_lead_id, p_happened_at);
  end if;

  begin
    insert into public.activity_events (
      actor_user_id,
      metric_key,
      value,
      happened_at,
      source,
      idempotency_key,
      metadata
    )
    values (
      auth.uid(),
      p_metric_key,
      p_value,
      p_happened_at,
      p_source,
      v_final_idempotency,
      p_metadata
    )
    returning id into v_event_id;

  exception
    when unique_violation then
      -- If dedupe key collided, return existing event id
      if v_final_idempotency is null then
        raise;
      end if;

      select id into v_event_id
      from public.activity_events
      where idempotency_key = v_final_idempotency
      limit 1;

      if v_event_id is null then
        raise;
      end if;
  end;

  -- Audit (if your policy allows)
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
      'idempotency_key', v_final_idempotency,
      'lead_id', v_lead_id
    )
  );

  return v_event_id;
end;
$$;

commit;
