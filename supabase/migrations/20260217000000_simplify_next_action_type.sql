-- 20260217000000_simplify_next_action_type.sql
-- Simplifica next_action_type a: NULL | 'contact' | 'meeting'
-- Mapea valores legacy:
--   call/follow_up -> contact
--   presentation   -> meeting
--   meeting        -> meeting

begin;

-- 1) Eliminar constraint anterior antes de modificar datos
alter table public.leads
  drop constraint if exists leads_next_action_type_check;

-- 2) Migrar datos existentes
update public.leads
set next_action_type =
  case
    when next_action_type in ('call', 'follow_up') then 'contact'
    when next_action_type = 'presentation' then 'meeting'
    when next_action_type = 'meeting' then 'meeting'
    else next_action_type
  end
where next_action_type in ('call', 'follow_up', 'presentation', 'meeting');

-- 3) Limpieza defensiva (por si existen valores inválidos históricos)
update public.leads
set next_action_type = null
where next_action_type is not null
  and (
    btrim(next_action_type) = ''
    or next_action_type ilike 'none'
  );

-- 4) Crear nuevo constraint definitivo
alter table public.leads
  add constraint leads_next_action_type_check
  check (
    next_action_type is null
    or next_action_type in ('contact', 'meeting')
  );

commit;
