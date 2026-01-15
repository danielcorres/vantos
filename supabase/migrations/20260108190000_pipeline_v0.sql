-- =====================================================
-- Pipeline v0 – VANT (Sistema interno, una sola agencia)
-- Stack: Supabase (Postgres)
-- Modelo:
--  - Etapas globales (pipeline_stages)
--  - Leads aislados por owner_user_id = auth.uid()
--  - History aislado por el lead (via EXISTS)
--  - Seeds globales (sin auth/jwt)
-- =====================================================

create extension if not exists "pgcrypto";

-- =========================
-- HELPERS
-- =========================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================
-- TABLE: pipeline_stages (global)
-- =========================
create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position int not null,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  created_by uuid null, -- puede ser null en seeds/migraciones

  constraint pipeline_stages_position_unique unique (position)
);

create index if not exists pipeline_stages_active_pos_idx
  on public.pipeline_stages(is_active, position);

-- =========================
-- TABLE: leads (aislado por owner_user_id)
-- =========================
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),

  owner_user_id uuid not null default auth.uid(),

  full_name text not null,
  phone text,
  email text,
  source text,
  notes text,

  stage_id uuid not null,
  stage_changed_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint leads_stage_fk
    foreign key (stage_id)
    references public.pipeline_stages(id)
);

create index if not exists leads_owner_stage_idx
  on public.leads(owner_user_id, stage_id);

create index if not exists leads_owner_created_idx
  on public.leads(owner_user_id, created_at desc);

drop trigger if exists t_leads_updated_at on public.leads;
create trigger t_leads_updated_at
before update on public.leads
for each row
execute function public.set_updated_at();

-- =========================
-- TABLE: lead_stage_history
-- =========================
create table if not exists public.lead_stage_history (
  id uuid primary key default gen_random_uuid(),

  lead_id uuid not null,
  from_stage_id uuid,
  to_stage_id uuid not null,

  moved_by uuid not null default auth.uid(),
  moved_at timestamptz not null default now(),

  idempotency_key text not null,

  constraint lead_stage_history_lead_fk
    foreign key (lead_id)
    references public.leads(id),

  constraint lead_stage_history_to_stage_fk
    foreign key (to_stage_id)
    references public.pipeline_stages(id)
);

create index if not exists lead_stage_history_lead_idx
  on public.lead_stage_history(lead_id, moved_at desc);

-- Idempotencia: la hacemos por usuario para evitar colisiones raras
create unique index if not exists lead_stage_history_idem_unique
  on public.lead_stage_history(moved_by, idempotency_key);

-- =========================
-- RLS
-- =========================
alter table public.pipeline_stages enable row level security;
alter table public.leads enable row level security;
alter table public.lead_stage_history enable row level security;

-- pipeline_stages: global (todos autenticados pueden leer)
drop policy if exists pipeline_stages_select on public.pipeline_stages;
create policy pipeline_stages_select
on public.pipeline_stages
for select
to authenticated
using (true);

-- (Opcional) si no quieres editar etapas desde la app, NO damos write.
-- Si quieres permitir admin en el futuro, se hace otra policy por rol/claim.

-- leads: solo dueño
drop policy if exists leads_select on public.leads;
create policy leads_select
on public.leads
for select
to authenticated
using (owner_user_id = auth.uid());

drop policy if exists leads_insert on public.leads;
create policy leads_insert
on public.leads
for insert
to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists leads_update on public.leads;
create policy leads_update
on public.leads
for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

drop policy if exists leads_delete on public.leads;
create policy leads_delete
on public.leads
for delete
to authenticated
using (owner_user_id = auth.uid());

-- lead_stage_history: visible/insertable solo si el lead es del usuario
drop policy if exists lead_stage_history_select on public.lead_stage_history;
create policy lead_stage_history_select
on public.lead_stage_history
for select
to authenticated
using (
  exists (
    select 1
    from public.leads l
    where l.id = lead_stage_history.lead_id
      and l.owner_user_id = auth.uid()
  )
);

drop policy if exists lead_stage_history_insert on public.lead_stage_history;
create policy lead_stage_history_insert
on public.lead_stage_history
for insert
to authenticated
with check (
  exists (
    select 1
    from public.leads l
    where l.id = lead_stage_history.lead_id
      and l.owner_user_id = auth.uid()
  )
);

-- =========================
-- RPC: move_lead_stage
-- =========================
create or replace function public.move_lead_stage(
  p_lead_id uuid,
  p_to_stage_id uuid,
  p_idempotency_key text
)
returns table (
  lead_id uuid,
  from_stage_id uuid,
  to_stage_id uuid,
  moved_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_stage_id uuid;
  v_now timestamptz := now();
begin
  -- idempotency (por moved_by + key)
  if exists (
    select 1
    from public.lead_stage_history h
    where h.moved_by = auth.uid()
      and h.idempotency_key = p_idempotency_key
  ) then
    return query
    select h.lead_id, h.from_stage_id, h.to_stage_id, h.moved_at
    from public.lead_stage_history h
    where h.moved_by = auth.uid()
      and h.idempotency_key = p_idempotency_key
    limit 1;
    return;
  end if;

  -- lock lead y validar ownership
  select l.stage_id
    into v_from_stage_id
  from public.leads l
  where l.id = p_lead_id
    and l.owner_user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Lead no encontrado o sin acceso';
  end if;

  -- validar etapa destino (global)
  if not exists (
    select 1
    from public.pipeline_stages s
    where s.id = p_to_stage_id
      and s.is_active = true
  ) then
    raise exception 'Etapa destino inválida';
  end if;

  -- history
  insert into public.lead_stage_history(
    lead_id, from_stage_id, to_stage_id, moved_by, moved_at, idempotency_key
  ) values (
    p_lead_id, v_from_stage_id, p_to_stage_id, auth.uid(), v_now, p_idempotency_key
  );

  -- update lead
  update public.leads
  set stage_id = p_to_stage_id,
      stage_changed_at = v_now
  where id = p_lead_id
    and owner_user_id = auth.uid();

  return query
  select p_lead_id, v_from_stage_id, p_to_stage_id, v_now;
end;
$$;

revoke all on function public.move_lead_stage(uuid, uuid, text) from public;
grant execute on function public.move_lead_stage(uuid, uuid, text) to authenticated;

-- =========================
-- SEED GLOBAL (sin auth/jwt)
-- =========================
insert into public.pipeline_stages (name, position, is_active, created_by)
values
  ('Nuevo', 1, true, null),
  ('Contactado', 2, true, null),
  ('Cita agendada', 3, true, null),
  ('Propuesta', 4, true, null),
  ('Cerrado', 5, true, null)
on conflict (position) do update
set name = excluded.name,
    is_active = excluded.is_active;
