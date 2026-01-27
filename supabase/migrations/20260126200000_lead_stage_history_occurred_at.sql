-- lead_stage_history.occurred_at: fecha real del evento (para hitos)
-- Si null, se usa moved_at como fallback en app.
-- Sin check con now() en DB; validación de futuro en app.

begin;

alter table public.lead_stage_history
  add column if not exists occurred_at timestamptz null;

comment on column public.lead_stage_history.occurred_at is
  'Fecha real en que ocurrió el evento (ej. cita realizada). Si null, usar moved_at.';

update public.lead_stage_history
set occurred_at = moved_at
where occurred_at is null;

create index if not exists lead_stage_history_lead_occurred_at_idx
  on public.lead_stage_history (lead_id, occurred_at desc nulls last);

commit;
