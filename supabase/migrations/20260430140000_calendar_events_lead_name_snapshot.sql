-- Snapshot del nombre del lead en calendar_events cuando el lead se elimina (FK pone lead_id en null).
-- Backfill heurístico: citas sin lead_id cuyo title coincide con full_name de un lead del mismo owner.

begin;

alter table public.calendar_events
  add column if not exists lead_name_snapshot text null;

comment on column public.calendar_events.lead_name_snapshot is
  'Nombre del lead al momento de eliminar el lead (FK on delete set null). UI: coalesce(join.full_name, snapshot, title).';

create or replace function public.snapshot_calendar_events_lead_name_on_lead_delete()
returns trigger
language plpgsql
security invoker
set search_path to public
as $function$
begin
  update public.calendar_events
  set lead_name_snapshot = coalesce(
    nullif(trim(lead_name_snapshot), ''),
    nullif(trim(old.full_name), '')
  )
  where lead_id = old.id;

  return old;
end;
$function$;

drop trigger if exists trg_leads_delete_snapshot_calendar_names on public.leads;
create trigger trg_leads_delete_snapshot_calendar_names
  before delete on public.leads
  for each row
  execute function public.snapshot_calendar_events_lead_name_on_lead_delete();

comment on function public.snapshot_calendar_events_lead_name_on_lead_delete() is
  'Antes de borrar un lead, copia full_name a calendar_events.lead_name_snapshot para filas que apuntan a ese lead.';

-- Backfill lead_id: title igual a full_name, mismo owner, sin lead_id (si hay varios leads con el mismo nombre, se elige el más reciente por updated_at).
update public.calendar_events ce
set lead_id = m.lead_id
from (
  select distinct on (ce_inner.id)
    ce_inner.id as event_id,
    l_inner.id as lead_id
  from public.calendar_events ce_inner
  inner join public.leads l_inner
    on l_inner.owner_user_id = ce_inner.owner_user_id
    and trim(both from coalesce(ce_inner.title, '')) = trim(both from coalesce(l_inner.full_name, ''))
    and trim(both from coalesce(ce_inner.title, '')) <> ''
    and ce_inner.lead_id is null
  order by ce_inner.id, l_inner.updated_at desc nulls last, l_inner.created_at desc nulls last
) m
where ce.id = m.event_id;

-- Quitar título redundante cuando ya hay lead y el texto solo duplica el nombre actual del lead.
update public.calendar_events ce
set title = null
from public.leads l
where ce.lead_id = l.id
  and ce.title is not null
  and trim(both from ce.title) = trim(both from coalesce(l.full_name, ''));

commit;
