-- requirements_status y application_status: solo valores permitidos o null (no guardar 'none')
-- Limpieza: convertir 'none' existentes a null
update public.leads
set requirements_status = null
where requirements_status = 'none';

update public.leads
set application_status = null
where application_status = 'none';

-- CHECK: requirements_status solo 'ra' o null
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_requirements_status_check'
  ) then
    alter table public.leads
      add constraint leads_requirements_status_check
      check (requirements_status is null or requirements_status = 'ra');
  end if;
end $$;

-- CHECK: application_status solo 'submitted' | 'signed' o null
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'leads_application_status_check'
  ) then
    alter table public.leads
      add constraint leads_application_status_check
      check (
        application_status is null
        or application_status in ('submitted', 'signed')
      );
  end if;
end $$;
