-- Al crear un lead, registrar entrada inicial en lead_stage_history para que
-- get_weekly_pipeline_entries / hub semanal / productividad cuenten el alta en la etapa
-- inicial (cualquier etapa del embudo: slug resuelto vía pipeline_stages, no solo contactos).

begin;

create or replace function public.trg_leads_insert_initial_stage_history()
returns trigger
language plpgsql
security invoker
set search_path to public
as $function$
begin
  insert into public.lead_stage_history (
    lead_id,
    from_stage_id,
    to_stage_id,
    moved_by,
    moved_at,
    idempotency_key,
    occurred_at
  ) values (
    new.id,
    null,
    new.stage_id,
    coalesce(auth.uid(), new.owner_user_id),
    coalesce(new.created_at, now()),
    'lead:initial:' || new.id::text,
    coalesce(new.created_at, now())
  )
  on conflict (lead_id, idempotency_key) do nothing;

  return new;
end;
$function$;

drop trigger if exists trg_leads_insert_initial_stage_history on public.leads;
create trigger trg_leads_insert_initial_stage_history
  after insert on public.leads
  for each row
  execute function public.trg_leads_insert_initial_stage_history();

comment on function public.trg_leads_insert_initial_stage_history() is
  'Inserta fila inicial en lead_stage_history al crear lead (from null → stage_id). Aplica a cualquier etapa del embudo; métricas semanales por slug en get_weekly_pipeline_entries. moved_by = coalesce(auth.uid(), owner).';

-- Datos previos sin ninguna fila de historial: una fila sintética con la fecha de la etapa actual.
insert into public.lead_stage_history (
  lead_id,
  from_stage_id,
  to_stage_id,
  moved_by,
  moved_at,
  idempotency_key,
  occurred_at
)
select
  l.id,
  null,
  l.stage_id,
  l.owner_user_id,
  coalesce(l.stage_changed_at, l.created_at),
  'lead:backfill:' || l.id::text,
  coalesce(l.stage_changed_at, l.created_at)
from public.leads l
where not exists (select 1 from public.lead_stage_history h where h.lead_id = l.id)
on conflict (lead_id, idempotency_key) do nothing;

commit;
