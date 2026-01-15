-- 20260109180000_create_okr_goal_settings.sql
-- Tabla para configuración de metas diarias por usuario

begin;

create table if not exists public.okr_goal_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_target integer not null default 25 check (daily_target >= 10 and daily_target <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_okr_goal_settings_user
on public.okr_goal_settings (user_id);

alter table public.okr_goal_settings enable row level security;

-- RLS policy
do $$ begin
  create policy "okr_goal_settings_owner"
  on public.okr_goal_settings
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Trigger para actualizar updated_at
create or replace function public.update_okr_goal_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists okr_goal_settings_updated_at on public.okr_goal_settings;
create trigger okr_goal_settings_updated_at
before update on public.okr_goal_settings
for each row
execute function public.update_okr_goal_settings_updated_at();

commit;
