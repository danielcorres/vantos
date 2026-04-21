-- pipeline_cleanup_remove_legacy_and_add_momento
-- 1) Añade momento_override (solo 'por_definir' o null).
-- 2) Asegura next_action_type en ('contact','meeting') o null.
-- 3) Elimina columnas legacy de estado (UI y modelo minimalista).
-- NOTA: lead_condition se mantiene en DB (usado por insights: conditionCounts).
--       Se elimina solo de la UI del pipeline (reemplazada por Momento).

begin;

-- 1) Columna momento_override
alter table public.leads
  add column if not exists momento_override text null;

alter table public.leads
  drop constraint if exists leads_momento_override_check;

alter table public.leads
  add constraint leads_momento_override_check
  check (momento_override is null or momento_override = 'por_definir');

-- 2) next_action_type: dropear constraint viejo si existe y normalizar
alter table public.leads
  drop constraint if exists leads_next_action_type_check;

update public.leads
set next_action_type =
  case
    when next_action_type in ('call', 'follow_up') then 'contact'
    when next_action_type in ('presentation', 'meeting') then 'meeting'
    when next_action_type in ('contact', 'meeting') then next_action_type
    else null
  end
where next_action_type is not null;

alter table public.leads
  add constraint leads_next_action_type_check
  check (next_action_type is null or next_action_type in ('contact', 'meeting'));

-- 3) Eliminar columnas legacy de estado (no usadas en otros módulos)
-- lead_condition: NO se dropea (insights.api getConditionCounts lo usa).
alter table public.leads drop column if exists application_status;
alter table public.leads drop column if exists requirements_status;
alter table public.leads drop column if exists quote_status;
alter table public.leads drop column if exists last_contact_outcome;
alter table public.leads drop column if exists close_outcome;

commit;
