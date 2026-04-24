-- ============================================================
-- Módulo Policies (pólizas de seguro)
-- RLS: owner_user_id = auth.uid()
-- Sin FK a leads (lead_id nullable, integración futura)
-- ============================================================

begin;

create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),

  owner_user_id uuid not null references auth.users(id) on delete cascade,

  lead_id uuid null,

  contractor_name text not null,
  insurer text not null,
  policy_number text not null,
  ramo text not null
    check (ramo in ('vida', 'gmm', 'daños', 'auto', 'rc')),
  product_name text not null,

  start_date date not null,
  end_date date not null,
  issued_at date null,

  premium_amount numeric(12, 2) not null
    check (premium_amount > 0),
  currency text not null default 'mxn'
    check (currency in ('mxn', 'usd', 'udi')),
  payment_frequency text not null
    check (payment_frequency in ('annual', 'semiannual', 'quarterly', 'monthly')),

  receipt_status text not null default 'pending'
    check (receipt_status in ('paid', 'pending', 'overdue')),

  campaign_source text null,
  is_countable boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint policies_start_before_end check (start_date <= end_date)
);

create unique index if not exists policies_policy_number_owner_uniq
  on public.policies (policy_number, owner_user_id);

create index if not exists policies_owner_idx on public.policies (owner_user_id);
create index if not exists policies_ramo_idx on public.policies (ramo);
create index if not exists policies_insurer_idx on public.policies (insurer);
create index if not exists policies_end_date_idx on public.policies (end_date);
create index if not exists policies_start_date_idx on public.policies (start_date);

drop trigger if exists policies_set_updated_at on public.policies;
create trigger policies_set_updated_at
  before update on public.policies
  for each row
  execute function public.set_updated_at();

alter table public.policies enable row level security;

drop policy if exists policies_select_own on public.policies;
create policy policies_select_own
  on public.policies
  for select
  to authenticated
  using (owner_user_id = auth.uid());

drop policy if exists policies_insert_own on public.policies;
create policy policies_insert_own
  on public.policies
  for insert
  to authenticated
  with check (owner_user_id = auth.uid());

drop policy if exists policies_update_own on public.policies;
create policy policies_update_own
  on public.policies
  for update
  to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

drop policy if exists policies_delete_own on public.policies;
create policy policies_delete_own
  on public.policies
  for delete
  to authenticated
  using (owner_user_id = auth.uid());

commit;
