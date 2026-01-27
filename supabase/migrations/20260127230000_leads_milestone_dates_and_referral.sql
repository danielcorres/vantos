begin;

alter table public.leads
  add column if not exists cita_realizada_at timestamptz null,
  add column if not exists propuesta_presentada_at timestamptz null,
  add column if not exists cerrado_at timestamptz null,
  add column if not exists referral_name text null;

comment on column public.leads.cita_realizada_at is 'Fecha real en que se realizó la cita (editable).';
comment on column public.leads.propuesta_presentada_at is 'Fecha real en que se presentó la propuesta (editable).';
comment on column public.leads.cerrado_at is 'Fecha real de cierre (ganado o perdido), editable.';
comment on column public.leads.referral_name is 'Nombre de la persona que refirió al lead (si source=Referido).';

-- Backfill inicial desde lead_stage_history (si existe)
-- Usar occurred_at si existe, si no moved_at.
-- NOTA: Tomamos la última fecha registrada para cada hito (max).
with h as (
  select
    lead_id,
    max(case when lower(s.name) = 'cita realizada' then coalesce(h.occurred_at, h.moved_at) end) as cita_realizada_at,
    max(case when lower(s.name) in ('propuesta', 'propuesta presentada') then coalesce(h.occurred_at, h.moved_at) end) as propuesta_presentada_at,
    max(case when lower(s.name) in ('cerrado ganado', 'cerrado perdido') then coalesce(h.occurred_at, h.moved_at) end) as cerrado_at
  from public.lead_stage_history h
  join public.pipeline_stages s on s.id = h.to_stage_id
  group by lead_id
)
update public.leads l
set
  cita_realizada_at = coalesce(l.cita_realizada_at, h.cita_realizada_at),
  propuesta_presentada_at = coalesce(l.propuesta_presentada_at, h.propuesta_presentada_at),
  cerrado_at = coalesce(l.cerrado_at, h.cerrado_at),
  updated_at = now()
from h
where h.lead_id = l.id;

commit;
