-- ============================================================
-- lead_condition (tag secundario guardado) + campos para tag principal
-- RLS no se modifica; owner_user_id ya limita.
-- ============================================================

-- lead_condition: solo valores permitidos o null
alter table public.leads
  add column if not exists lead_condition text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_lead_condition_check'
  ) then
    alter table public.leads
      add constraint leads_lead_condition_check
      check (
        lead_condition is null
        or lead_condition in (
          'waiting_client',
          'docs_pending',
          'paused',
          'budget',
          'unreachable'
        )
      );
  end if;
end $$;

-- Campos usados para derivar el tag principal por etapa (no obligatorios)
alter table public.leads
  add column if not exists last_contact_outcome text null,
  add column if not exists quote_status text null,
  add column if not exists close_outcome text null,
  add column if not exists requirements_status text null,
  add column if not exists application_status text null;
