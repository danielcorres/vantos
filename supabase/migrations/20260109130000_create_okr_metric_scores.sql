-- 20260109130000_create_okr_metric_scores.sql
-- Tabla para scoring configurable por usuario y métrica

begin;

create table if not exists public.okr_metric_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_key text not null references public.metric_definitions(key) on delete restrict,
  points_per_unit integer not null default 0 check (points_per_unit >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, metric_key)
);

create index if not exists idx_okr_metric_scores_user
on public.okr_metric_scores (user_id, metric_key);

alter table public.okr_metric_scores enable row level security;

-- RLS policies
do $$ begin
  create policy "okr_metric_scores_select_self"
  on public.okr_metric_scores
  for select
  to authenticated
  using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "okr_metric_scores_insert_self"
  on public.okr_metric_scores
  for insert
  to authenticated
  with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "okr_metric_scores_update_self"
  on public.okr_metric_scores
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "okr_metric_scores_delete_self"
  on public.okr_metric_scores
  for delete
  to authenticated
  using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Seed defaults: se hará automáticamente al insertar desde el frontend
-- No hacer seed en migración porque requiere auth.uid() que no está disponible aquí

commit;
