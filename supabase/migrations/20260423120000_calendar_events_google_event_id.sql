-- Reservado para sincronización con Google Calendar (Fase 3).
alter table public.calendar_events
  add column if not exists google_event_id text null;

comment on column public.calendar_events.google_event_id is 'ID del evento en Google Calendar cuando exista integración OAuth.';
