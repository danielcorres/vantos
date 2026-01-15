-- 20260112230000_okr_global_scoring_final.sql
-- Objetivo:
-- - Scoring GLOBAL (igual para todos)
-- - Solo OWNER (admin OKR) edita scoring
-- - get_okr_points_progress deja de depender de okr_goal_settings y user_id
-- - RPC admin para puntos por asesor
-- - NO tocar activity_events

begin;

-- 1) Tabla scoring GLOBAL
create table if not exists public.okr_metric_scores_global (
  metric_key text primary key
    references public.metric_definitions(key),
  points_per_unit int not null check (points_per_unit >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2) Trigger updated_at (si no existe en tu proyecto, esto es seguro)
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_okr_metric_scores_global_updated_at on public.okr_metric_scores_global;
create trigger trg_okr_metric_scores_global_updated_at
before update on public.okr_metric_scores_global
for each row execute function public.set_updated_at();

-- 3) Backfill desde tabla legacy por usuario (si existe)
--    Usa MAX(points_per_unit) por metric_key como "valor vigente"
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema='public' and table_name='okr_metric_scores'
  ) then
    insert into public.okr_metric_scores_global(metric_key, points_per_unit)
    select metric_key, max(points_per_unit)::int
    from public.okr_metric_scores
    group by metric_key
    on conflict (metric_key) do update
      set points_per_unit = excluded.points_per_unit,
          updated_at = now();
  end if;
end $$;

-- 4) Helper: es owner/admin OKR (owner_user_id de okr_settings_global)
create or replace function public.okr_is_owner()
returns boolean
language sql
stable
as $$
  select auth.uid() is not null
     and auth.uid() = (
       select s.owner_user_id
       from public.okr_settings_global s
       order by s.created_at asc
       limit 1
     );
$$;

-- 5) RLS para scoring global: lectura para todos, escritura solo owner
alter table public.okr_metric_scores_global enable row level security;

drop policy if exists okr_metric_scores_global_select_all on public.okr_metric_scores_global;
create policy okr_metric_scores_global_select_all
on public.okr_metric_scores_global
for select
to authenticated
using (true);

-- 🔧 FIX: policies separadas (Postgres no soporta "for insert, update, delete" en una sola)
drop policy if exists okr_metric_scores_global_insert_owner on public.okr_metric_scores_global;
create policy okr_metric_scores_global_insert_owner
on public.okr_metric_scores_global
for insert
to authenticated
with check (public.okr_is_owner());

drop policy if exists okr_metric_scores_global_update_owner on public.okr_metric_scores_global;
create policy okr_metric_scores_global_update_owner
on public.okr_metric_scores_global
for update
to authenticated
using (public.okr_is_owner())
with check (public.okr_is_owner());

drop policy if exists okr_metric_scores_global_delete_owner on public.okr_metric_scores_global;
create policy okr_metric_scores_global_delete_owner
on public.okr_metric_scores_global
for delete
to authenticated
using (public.okr_is_owner());





-- 6) Reemplazar RPC: upsert_okr_metric_scores (mantiene nombre para no romper frontend)
--    Ahora escribe GLOBAL y SOLO owner puede ejecutar.
create or replace function public.upsert_okr_metric_scores(p_entries jsonb)
returns void
language plpgsql
security definer
as $$
declare
  v_entry jsonb;
  v_metric_key text;
  v_points_per_unit integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.okr_is_owner() then
    raise exception 'Not authorized: only owner can edit global scoring';
  end if;

  if jsonb_typeof(p_entries) != 'array' then
    raise exception 'p_entries must be a JSON array';
  end if;

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    if jsonb_typeof(v_entry->'metric_key') != 'string'
       or (v_entry->'points_per_unit') is null then
      raise exception 'Each entry must have metric_key and points_per_unit';
    end if;

    v_metric_key := v_entry->>'metric_key';
    v_points_per_unit := (v_entry->>'points_per_unit')::integer;

    if v_metric_key is null or length(trim(v_metric_key)) = 0 then
      raise exception 'metric_key cannot be empty';
    end if;

    if v_points_per_unit is null or v_points_per_unit < 0 then
      raise exception 'points_per_unit must be >= 0 for metric_key: %', v_metric_key;
    end if;

    if not exists (
      select 1 from public.metric_definitions md
      where md.key = v_metric_key and md.is_active = true
    ) then
      raise exception 'metric_key does not exist or is inactive: %', v_metric_key;
    end if;
  end loop;

  insert into public.okr_metric_scores_global(metric_key, points_per_unit)
  select
    (e->>'metric_key')::text,
    (e->>'points_per_unit')::integer
  from jsonb_array_elements(p_entries) e
  on conflict (metric_key) do update
  set points_per_unit = excluded.points_per_unit,
      updated_at = now();
end;
$$;

-- 7) Reemplazar RPC: get_okr_points_progress (mantiene nombre para no romper frontend)
--    Ahora usa:
--    - scoring GLOBAL (okr_metric_scores_global)
--    - meta diaria GLOBAL (okr_settings_global.daily_expected_points)
--    - day_local por recorded_at en TZ Monterrey
create or replace function public.get_okr_points_progress(p_date_local date)
returns table (
  date_local date,
  current_points integer,
  base_target integer,
  stretch_target integer,
  extra_points integer
)
language sql
stable
as $$
  with settings as (
    select
      coalesce(s.daily_expected_points, 25)::int as daily_expected_points
    from public.okr_settings_global s
    order by s.created_at asc
    limit 1
  ),
  pts as (
    select
      coalesce(sum(e.value * coalesce(g.points_per_unit,0)),0)::int as points
    from public.activity_events e
    left join public.okr_metric_scores_global g
      on g.metric_key = e.metric_key
    where e.actor_user_id = auth.uid()
      and e.is_void = false
      and e.source = 'manual'
      and e.metadata->>'entry_source' = 'okr_daily'
      and (e.recorded_at at time zone 'America/Monterrey')::date = p_date_local
  )
  select
    p_date_local as date_local,
    pts.points as current_points,
    s.daily_expected_points as base_target,
    round(s.daily_expected_points * 1.5)::int as stretch_target,
    greatest(pts.points - s.daily_expected_points, 0)::int as extra_points
  from pts
  cross join settings s;
$$;

-- 8) RPC ADMIN: puntos por asesor (día local)
--    Usa tu helper existente is_admin_or_owner() (ya aparece en RLS de activity_events)
create or replace function public.okr_admin_points_by_user_daily(p_date_local date)
returns table (
  actor_user_id uuid,
  points integer
)
language sql
stable
as $$
  select
    e.actor_user_id,
    coalesce(sum(e.value * coalesce(g.points_per_unit,0)),0)::int as points
  from public.activity_events e
  left join public.okr_metric_scores_global g
    on g.metric_key = e.metric_key
  where is_admin_or_owner()
    and e.is_void = false
    and e.source = 'manual'
    and e.metadata->>'entry_source' = 'okr_daily'
    and (e.recorded_at at time zone 'America/Monterrey')::date = p_date_local
  group by e.actor_user_id
  order by points desc;
$$;

commit;
