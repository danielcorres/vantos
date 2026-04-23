-- Idempotente: corrige entornos donde no existía la columna (p. ej. error PostgREST "schema cache").
alter table public.calendar_events
  add column if not exists google_event_id text null;

comment on column public.calendar_events.google_event_id is 'ID del evento en Google Calendar cuando exista integración OAuth (push).';
