begin;

alter table public.leads
  add column if not exists estimated_value numeric;

alter table public.leads
  add column if not exists expected_close_at timestamptz;

alter table public.leads
  add column if not exists owner_user_id uuid references auth.users(id);

create index if not exists leads_owner_user_id_idx
  on public.leads(owner_user_id);

create index if not exists leads_expected_close_at_idx
  on public.leads(expected_close_at);

commit;