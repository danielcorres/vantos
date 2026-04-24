-- Campos adicionales en policies + ampliar payment_frequency (bimonthly / cuatrimestral)

begin;

alter table public.policies
  add column if not exists contract_end_date date null,
  add column if not exists first_payment numeric(12, 2) null
    constraint policies_first_payment_positive check (first_payment is null or first_payment > 0),
  add column if not exists remind_periodic_billing boolean not null default false;

-- Sustituir check de payment_frequency para incluir bimonthly (nombre del constraint puede variar)
do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'policies'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%payment_frequency%'
  loop
    execute format('alter table public.policies drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.policies
  add constraint policies_payment_frequency_check
  check (payment_frequency in ('annual', 'semiannual', 'quarterly', 'bimonthly', 'monthly'));

commit;
