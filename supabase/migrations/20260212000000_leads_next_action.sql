-- Next Action obligatorio para leads activos (Pipeline puro)
-- leads.next_action_at timestamptz, leads.next_action_type text

alter table public.leads
  add column if not exists next_action_at timestamptz null,
  add column if not exists next_action_type text null;

-- Backfill: leads activos sin next_action_at -> now() + 1 day
update public.leads
set next_action_at = (now() + interval '1 day')
where archived_at is null and next_action_at is null;

-- Activos deben tener next_action_at
alter table public.leads
  drop constraint if exists leads_next_action_when_active;

alter table public.leads
  add constraint leads_next_action_when_active
  check (archived_at is not null or next_action_at is not null);

-- next_action_type solo valores permitidos o null
alter table public.leads
  drop constraint if exists leads_next_action_type_check;

alter table public.leads
  add constraint leads_next_action_type_check
  check (
    next_action_type is null
    or next_action_type in ('call', 'meeting', 'follow_up', 'presentation')
  );
