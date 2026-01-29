-- ============================================================
-- Calendario interno — tabla calendar_events + RLS
-- Scope: owner_user_id = auth.uid()
-- Tipos: first_meeting | closing | follow_up
-- Status: scheduled | completed | no_show | canceled
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabla public.calendar_events
-- ------------------------------------------------------------
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),

  owner_user_id uuid not null references auth.users(id) on delete cascade,

  lead_id uuid null,

  type text not null
    check (type in ('first_meeting', 'closing', 'follow_up')),

  status text not null default 'scheduled'
    check (status in ('scheduled', 'completed', 'no_show', 'canceled')),

  starts_at timestamptz not null,
  ends_at timestamptz not null,

  title text null,
  notes text null,
  location text null,
  meeting_link text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- FK lead_id -> public.leads(id): existe tabla leads con PK id (uuid)
alter table public.calendar_events
  add constraint calendar_events_lead_id_fkey
  foreign key (lead_id)
  references public.leads(id)
  on delete set null;

-- ------------------------------------------------------------
-- 2) Trigger updated_at (usa función existente set_updated_at)
-- ------------------------------------------------------------
drop trigger if exists t_calendar_events_updated_at on public.calendar_events;
create trigger t_calendar_events_updated_at
  before update on public.calendar_events
  for each row
  execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 3) Índices
-- ------------------------------------------------------------
create index if not exists calendar_events_owner_starts_idx
  on public.calendar_events(owner_user_id, starts_at);

create index if not exists calendar_events_owner_lead_starts_idx
  on public.calendar_events(owner_user_id, lead_id, starts_at);

create index if not exists calendar_events_owner_status_starts_idx
  on public.calendar_events(owner_user_id, status, starts_at);

-- ------------------------------------------------------------
-- 4) RLS
-- ------------------------------------------------------------
alter table public.calendar_events enable row level security;

drop policy if exists calendar_events_select_own on public.calendar_events;
create policy calendar_events_select_own
  on public.calendar_events
  for select
  to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists calendar_events_insert_own on public.calendar_events;
create policy calendar_events_insert_own
  on public.calendar_events
  for insert
  to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists calendar_events_update_own on public.calendar_events;
create policy calendar_events_update_own
  on public.calendar_events
  for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists calendar_events_delete_own on public.calendar_events;
create policy calendar_events_delete_own
  on public.calendar_events
  for delete
  to authenticated
  using (owner_user_id = auth.uid());
