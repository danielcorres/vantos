-- Asegurados por póliza (RLS vía póliza del mismo propietario)

begin;

create table if not exists public.policy_insured (
  id uuid primary key default gen_random_uuid(),
  policy_id uuid not null references public.policies(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  relationship text not null default 'titular'
    check (relationship in ('titular', 'spouse', 'child', 'parent', 'other')),
  birth_date date null,
  phone text null,
  email text null,
  notes text null,
  client_number text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists policy_insured_policy_idx on public.policy_insured (policy_id);
create index if not exists policy_insured_owner_idx on public.policy_insured (owner_user_id);

drop trigger if exists policy_insured_set_updated_at on public.policy_insured;
create trigger policy_insured_set_updated_at
  before update on public.policy_insured
  for each row
  execute function public.set_updated_at();

alter table public.policy_insured enable row level security;

drop policy if exists policy_insured_select on public.policy_insured;
create policy policy_insured_select
  on public.policy_insured
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.policies p
      where p.id = policy_insured.policy_id
        and p.owner_user_id = auth.uid()
    )
  );

drop policy if exists policy_insured_insert on public.policy_insured;
create policy policy_insured_insert
  on public.policy_insured
  for insert
  to authenticated
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.policies p
      where p.id = policy_insured.policy_id
        and p.owner_user_id = auth.uid()
    )
  );

drop policy if exists policy_insured_update on public.policy_insured;
create policy policy_insured_update
  on public.policy_insured
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.policies p
      where p.id = policy_insured.policy_id
        and p.owner_user_id = auth.uid()
    )
  )
  with check (
    owner_user_id = auth.uid()
    and exists (
      select 1
      from public.policies p
      where p.id = policy_insured.policy_id
        and p.owner_user_id = auth.uid()
    )
  );

drop policy if exists policy_insured_delete on public.policy_insured;
create policy policy_insured_delete
  on public.policy_insured
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.policies p
      where p.id = policy_insured.policy_id
        and p.owner_user_id = auth.uid()
    )
  );

commit;
