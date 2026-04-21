-- drop_momento_override
-- Elimina la columna momento_override de la tabla leads.
-- La funcionalidad "Momento" fue eliminada del sistema Pipeline.
-- El pipeline opera solo con stage + next_action.

begin;

alter table public.leads
  drop constraint if exists leads_momento_override_check;

alter table public.leads
  drop column if exists momento_override;

commit;
