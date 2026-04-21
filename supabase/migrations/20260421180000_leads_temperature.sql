-- Temperatura de interés del lead (independiente de source y lead_condition).
-- NULL = sin clasificar.

alter table public.leads
  add column if not exists temperature text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_temperature_check'
  ) then
    alter table public.leads
      add constraint leads_temperature_check
      check (
        temperature is null
        or temperature in ('frio', 'tibio', 'caliente')
      );
  end if;
end $$;

comment on column public.leads.temperature is
  'Temperatura de interés del lead (frio/tibio/caliente). Independiente de source (canal) y lead_condition (operativo).';
