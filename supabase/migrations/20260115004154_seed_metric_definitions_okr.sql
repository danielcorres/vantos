-- Seed OKR metrics into metric_definitions
-- Idempotente: no rompe si ya existen
-- NO borra nada, NO toca RLS, NO cambia lógica OKR

with desired as (
  select * from (values
    ('calls',                  'Llamadas',                'count',  10, true),
    ('meetings_set',           'Citas agendadas',         'count',  20, true),
    ('meetings_held',          'Citas realizadas',        'count',  30, true),
    ('proposals_presented',    'Propuestas presentadas',  'count',  40, true),
    ('applications_submitted', 'Solicitudes ingresadas',  'count',  50, true),
    ('referrals',              'Referidos',               'count',  60, true),
    ('policies_paid',          'Pólizas pagadas',         'count',  70, true)
  ) as t(key, label, unit, sort_order, is_active)
)
insert into public.metric_definitions (key, label, unit, sort_order, is_active)
select key, label, unit, sort_order, is_active
from desired
on conflict (key) do update
set
  -- Mantener catálogo alineado (sin afectar scoring ni eventos)
  label = excluded.label,
  unit = coalesce(excluded.unit, public.metric_definitions.unit),
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;
