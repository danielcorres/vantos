-- ============================================================
-- OKR SCORING GLOBAL (OWNER-MANAGED)
-- ============================================================
-- Convierte okr_metric_scores de:
--   scoring por usuario  →  scoring global de la agencia
-- Fuente de verdad: OWNER
-- ============================================================

-- ============================================================
-- 0) VALIDAR OWNER
-- ============================================================
do $$
begin
  if not exists (
    select 1
    from public.user_roles
    where user_id = 'cc5f3cce-a19d-4399-a1e8-5bb143be5143'::uuid
      and role = 'owner'
  ) then
    raise exception 'Owner user not found in user_roles';
  end if;
end $$;

-- ============================================================
-- 1) CONSOLIDAR SCORING DEL OWNER
-- ============================================================
create temp table _okr_scores_owner as
select metric_key, points_per_unit
from public.okr_metric_scores
where user_id = 'cc5f3cce-a19d-4399-a1e8-5bb143be5143'::uuid;

do $$
begin
  if not exists (select 1 from _okr_scores_owner) then
    raise exception 'Owner has no okr_metric_scores to consolidate';
  end if;
end $$;

-- ============================================================
-- 2) REEMPLAZAR TODO EL SCORING (MANTENIENDO user_id AÚN)
-- ============================================================
delete from public.okr_metric_scores;

insert into public.okr_metric_scores (user_id, metric_key, points_per_unit)
select
  'cc5f3cce-a19d-4399-a1e8-5bb143be5143'::uuid,
  metric_key,
  points_per_unit
from _okr_scores_owner;

drop table _okr_scores_owner;

-- ============================================================
-- 3) ELIMINAR CONSTRAINTS DEPENDIENTES DE user_id
-- ============================================================
alter table public.okr_metric_scores
  drop constraint if exists okr_metric_scores_user_id_metric_key_key;

alter table public.okr_metric_scores
  drop constraint if exists okr_metric_scores_user_id_fkey;

-- ============================================================
-- 4) ELIMINAR COLUMNA user_id (SCORING GLOBAL)
-- ============================================================
alter table public.okr_metric_scores
  drop column if exists user_id;

-- ============================================================
-- 5) GARANTIZAR 1 FILA POR metric_key
-- ============================================================
create unique index if not exists okr_metric_scores_metric_key_uniq
  on public.okr_metric_scores(metric_key);

-- ============================================================
-- 6) FUNCIÓN HELPER: is_owner()
-- ============================================================
create or replace function public.is_owner()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role = 'owner'
  );
$$;

-- ============================================================
-- 7) RLS PARA OKR METRIC SCORES
-- ============================================================
alter table public.okr_metric_scores enable row level security;

drop policy if exists "read scoring" on public.okr_metric_scores;
drop policy if exists "owner can insert scoring" on public.okr_metric_scores;
drop policy if exists "owner can update scoring" on public.okr_metric_scores;
drop policy if exists "owner can delete scoring" on public.okr_metric_scores;

-- Lectura: todos
create policy "read scoring"
on public.okr_metric_scores
for select
using (true);

-- Escritura: solo owner
create policy "owner can insert scoring"
on public.okr_metric_scores
for insert
with check (public.is_owner());

create policy "owner can update scoring"
on public.okr_metric_scores
for update
using (public.is_owner())
with check (public.is_owner());

create policy "owner can delete scoring"
on public.okr_metric_scores
for delete
using (public.is_owner());

-- ============================================================
-- 8) RPC: upsert_okr_metric_scores (OWNER ONLY)
-- ============================================================
create or replace function public.upsert_okr_metric_scores(p_entries jsonb)
returns void
language plpgsql
set search_path to 'public'
as $function$
declare
  v_entry jsonb;
  v_metric_key text;
  v_points_per_unit integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_owner() then
    raise exception 'Only owner can edit OKR scoring';
  end if;

  if jsonb_typeof(p_entries) != 'array' then
    raise exception 'p_entries must be a JSON array';
  end if;

  for v_entry in select * from jsonb_array_elements(p_entries)
  loop
    if jsonb_typeof(v_entry->'metric_key') != 'string' then
      raise exception 'metric_key must be string';
    end if;

    v_metric_key := v_entry->>'metric_key';
    v_points_per_unit := (v_entry->>'points_per_unit')::integer;

    if v_metric_key is null or length(trim(v_metric_key)) = 0 then
      raise exception 'metric_key cannot be empty';
    end if;

    if v_points_per_unit is null or v_points_per_unit < 0 then
      raise exception 'points_per_unit must be >= 0 for %', v_metric_key;
    end if;

    if not exists (
      select 1
      from public.metric_definitions
      where key = v_metric_key
        and is_active = true
    ) then
      raise exception 'metric_key not active or not found: %', v_metric_key;
    end if;
  end loop;

  insert into public.okr_metric_scores (metric_key, points_per_unit)
  select
    (e->>'metric_key')::text,
    (e->>'points_per_unit')::integer
  from jsonb_array_elements(p_entries) e
  on conflict (metric_key)
  do update set
    points_per_unit = excluded.points_per_unit;
end;
$function$;
