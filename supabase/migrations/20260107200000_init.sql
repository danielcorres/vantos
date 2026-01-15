-- 001_init.sql
-- Core schema for Vant (single-agency internal system)
-- Requires: pgcrypto for gen_random_uuid()



-- 001_init.sql
-- Core schema for Vant (single-agency internal system)
-- Requires: pgcrypto for gen_random_uuid()

begin;

-- Extensions
create extension if not exists pgcrypto;

-- ===============
-- 1) PROFILES
-- ===============
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'advisor' check (role in ('owner','admin','advisor','staff','viewer')),
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Helpers (for RLS) — MUST be after profiles table exists
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.user_id = auth.uid()
$$;

create or replace function public.is_admin_or_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('admin','owner'), false)
$$;

-- Profile policies
do $$ begin
  create policy "profiles_select_self_or_admin"
  on public.profiles
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin_or_owner());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "profiles_insert_self_or_admin"
  on public.profiles
  for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_admin_or_owner());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "profiles_update_self_or_admin"
  on public.profiles
  for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin_or_owner())
  with check (user_id = auth.uid() or public.is_admin_or_owner());
exception when duplicate_object then null; end $$;

-- Auto-create profile when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, role, display_name)
  values (
    new.id,
    'advisor',
    coalesce(new.raw_user_meta_data->>'display_name', new.email)
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

do $$ begin
  create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
exception when duplicate_object then null; end $$;

-- ===============
-- 1) PROFILES
-- ===============
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'advisor' check (role in ('owner','admin','advisor','staff','viewer')),
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Profile policies
do $$ begin
  create policy "profiles_select_self_or_admin"
  on public.profiles
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin_or_owner());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "profiles_insert_self_or_admin"
  on public.profiles
  for insert
  to authenticated
  with check (user_id = auth.uid() or public.is_admin_or_owner());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "profiles_update_self_or_admin"
  on public.profiles
  for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin_or_owner())
  with check (user_id = auth.uid() or public.is_admin_or_owner());
exception when duplicate_object then null; end $$;

-- Auto-create profile when a new auth user is created
-- NOTE: This is standard in Supabase, but included here to avoid AI “forgetting” onboarding essentials.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, role, display_name)
  values (
    new.id,
    'advisor',
    coalesce(new.raw_user_meta_data->>'display_name', new.email)
  )
  on conflict (user_id) do nothing;

  return new;
end;
$$;

do $$ begin
  create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
exception when duplicate_object then null; end $$;

-- ======================
-- 2) METRICS & RULES
-- ======================
create table if not exists public.metric_definitions (
  key text primary key,
  label text not null,
  unit text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.point_rules (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null references public.metric_definitions(key) on delete restrict,
  points int not null check (points >= 0),
  effective_from date not null default current_date,
  effective_to date null,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);

create index if not exists idx_point_rules_metric_effective
on public.point_rules (metric_key, effective_from desc);

alter table public.metric_definitions enable row level security;
alter table public.point_rules enable row level security;

-- metric_definitions policies
do $$ begin
  create policy "metric_definitions_read_authenticated"
  on public.metric_definitions
  for select
  to authenticated
  using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "metric_definitions_write_admin_only"
  on public.metric_definitions
  for all
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());
exception when duplicate_object then null; end $$;

-- point_rules policies
do $$ begin
  create policy "point_rules_read_authenticated"
  on public.point_rules
  for select
  to authenticated
  using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "point_rules_write_admin_only"
  on public.point_rules
  for all
  to authenticated
  using (public.is_admin_or_owner())
  with check (public.is_admin_or_owner());
exception when duplicate_object then null; end $$;

-- ======================
-- 3) ACTIVITY EVENTS
-- ======================
create table if not exists public.activity_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid not null references public.profiles(user_id) on delete cascade,
  metric_key text not null references public.metric_definitions(key) on delete restrict,
  value int not null default 1 check (value > 0),
  happened_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  source text not null check (source in ('manual','pipeline','system')),
  idempotency_key text null,
  metadata jsonb null,
  is_void boolean not null default false,
  void_reason text null,
  voided_at timestamptz null,
  voided_by uuid null references public.profiles(user_id) on delete set null
);

create index if not exists idx_activity_events_actor_happened
on public.activity_events (actor_user_id, happened_at desc);

create index if not exists idx_activity_events_metric_happened
on public.activity_events (metric_key, happened_at desc);

create unique index if not exists ux_activity_events_idempotency_key
on public.activity_events (idempotency_key)
where idempotency_key is not null;

alter table public.activity_events enable row level security;

-- activity_events policies
do $$ begin
  create policy "activity_events_select_self_or_admin"
  on public.activity_events
  for select
  to authenticated
  using (actor_user_id = auth.uid() or public.is_admin_or_owner());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "activity_events_insert_self_or_admin"
  on public.activity_events
  for insert
  to authenticated
  with check (actor_user_id = auth.uid() or public.is_admin_or_owner());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "activity_events_update_self_or_admin"
  on public.activity_events
  for update
  to authenticated
  using (actor_user_id = auth.uid() or public.is_admin_or_owner())
  with check (actor_user_id = auth.uid() or public.is_admin_or_owner());
exception when duplicate_object then null; end $$;

-- ======================
-- 4) TARGETS
-- ======================
create table if not exists public.targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  metric_key text not null references public.metric_definitions(key) on delete restrict,
  period_type text not null check (period_type in ('weekly','monthly')),
  period_start date not null,
  target_value int not null check (target_value > 0),
  created_at timestamptz not null default now(),
  unique (user_id, metric_key, period_type, period_start)
);

create index if not exists idx_targets_user_period
on public.targets (user_id, period_type, period_start desc);

alter table public.targets enable row level security;

do $$ begin
  create policy "targets_select_self_or_admin"
  on public.targets
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin_or_owner());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "targets_write_self_or_admin"
  on public.targets
  for all
  to authenticated
  using (user_id = auth.uid() or public.is_admin_or_owner())
  with check (user_id = auth.uid() or public.is_admin_or_owner());
exception when duplicate_object then null; end $$;

-- ======================
-- 5) AUDIT LOG
-- ======================
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid null references public.profiles(user_id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text null,
  before jsonb null,
  after jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_log_created
on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

do $$ begin
  create policy "audit_log_select_admin_only"
  on public.audit_log
  for select
  to authenticated
  using (public.is_admin_or_owner());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "audit_log_insert_admin_only"
  on public.audit_log
  for insert
  to authenticated
  with check (public.is_admin_or_owner());
exception when duplicate_object then null; end $$;

commit;
