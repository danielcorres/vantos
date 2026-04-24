-- Permitir borrado permanente del lead: historial en cascada + RLS delete para el dueño.

begin;

drop policy if exists lead_stage_history_delete_own on public.lead_stage_history;

create policy lead_stage_history_delete_own
on public.lead_stage_history
for delete
to authenticated
using (
  exists (
    select 1
    from public.leads l
    where l.id = lead_stage_history.lead_id
      and l.owner_user_id = auth.uid()
  )
);

comment on policy lead_stage_history_delete_own on public.lead_stage_history is
  'El dueño del lead puede borrar filas de historial (p. ej. al eliminar el lead con ON DELETE CASCADE).';

alter table public.lead_stage_history
  drop constraint if exists lead_stage_history_lead_fk;

alter table public.lead_stage_history
  add constraint lead_stage_history_lead_fk
  foreign key (lead_id)
  references public.leads(id)
  on delete cascade;

commit;
