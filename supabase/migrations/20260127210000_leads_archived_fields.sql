-- leads: campos de archivado (regla A: activos vs archivados)
-- NO modifica RLS.

begin;

alter table public.leads
  add column if not exists archived_at timestamptz null,
  add column if not exists archived_by uuid null,
  add column if not exists archive_reason text null;

comment on column public.leads.archived_at is 'Cuando se archivó el lead; null = no archivado.';
comment on column public.leads.archived_by is 'Usuario que archivó (auth.uid() al archivar).';
comment on column public.leads.archive_reason is 'Motivo opcional al archivar.';

commit;
