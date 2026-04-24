-- Quitar frecuencia cuatrimestral (bimonthly) y campos no usados (primer pago / recordatorio cobros)

begin;

update public.policies
set payment_frequency = 'quarterly'
where payment_frequency = 'bimonthly';

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
  check (payment_frequency in ('annual', 'semiannual', 'quarterly', 'monthly'));

alter table public.policies drop column if exists first_payment;
alter table public.policies drop column if exists remind_periodic_billing;

commit;
