-- Meta semanal de prima emitida (MXN) para embudo / etapa Pólizas Pagadas.
-- No sustituye policies_paid (conteo de pólizas en OKR diario).

insert into public.metric_definitions (key, label, unit, sort_order, is_active)
values (
  'written_premium_weekly_mxn',
  'Prima emitida semanal (MXN)',
  'mxn',
  75,
  true
)
on conflict (key) do update
set
  label = excluded.label,
  unit = excluded.unit,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active;
