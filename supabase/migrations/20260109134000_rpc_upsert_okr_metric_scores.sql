-- 20260109134000_rpc_upsert_okr_metric_scores.sql
-- RPC bulk para upsert de scoring (evitar REST directo y problemas de RLS)

begin;

create or replace function public.upsert_okr_metric_scores(
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
  v_points_per_unit integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  v_user_id := auth.uid();

  -- Validar p_entries es un array
  if jsonb_typeof(p_entries) != 'array' then
    raise exception 'p_entries must be a JSON array';
  end if;

  -- Para cada entrada, validar y procesar
  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    -- Validar estructura
    if jsonb_typeof(v_entry->'metric_key') != 'string' or jsonb_typeof(v_entry->'points_per_unit') != 'number' then
      raise exception 'Each entry must have metric_key (string) and points_per_unit (number)';
    end if;

    v_metric_key := v_entry->>'metric_key';
    v_points_per_unit := (v_entry->>'points_per_unit')::integer;

    -- Validar metric_key no vacío
    if v_metric_key is null or length(trim(v_metric_key)) = 0 then
      raise exception 'metric_key cannot be empty';
    end if;

    -- Validar points_per_unit >= 0
    if v_points_per_unit is null or v_points_per_unit < 0 then
      raise exception 'points_per_unit must be >= 0 for metric_key: %', v_metric_key;
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
  end loop;

  -- Bulk upsert usando INSERT ... ON CONFLICT
  insert into public.okr_metric_scores (user_id, metric_key, points_per_unit)
  select
    v_user_id,
    (e->>'metric_key')::text,
    (e->>'points_per_unit')::integer
  from jsonb_array_elements(p_entries) e
  on conflict (user_id, metric_key)
  do update set
    points_per_unit = excluded.points_per_unit;
end;
$$;

grant execute on function public.upsert_okr_metric_scores(jsonb) to authenticated;

commit;
