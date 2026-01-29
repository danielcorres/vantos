-- ============================================================
-- KPI Insights: días desde última cita "Cierre" (completed) → Ganado
-- Fuente won_at: leads.cerrado_at (fecha real de cierre; ganado si stage = casos_ganados).
-- presentation_at: última calendar_events type=closing, status=completed, ends_at <= cerrado_at.
-- RLS: respetado vía leads y calendar_events (owner_user_id).
-- ============================================================

create or replace view public.pipeline_kpi_close_to_won as
with closing_before_won as (
  select
    ce.lead_id,
    max(ce.ends_at) as presentation_at
  from public.calendar_events ce
  inner join public.leads l on l.id = ce.lead_id and l.cerrado_at is not null and ce.ends_at <= l.cerrado_at
  inner join public.pipeline_stages s on s.id = l.stage_id and s.slug = 'casos_ganados'
  where ce.type = 'closing'
    and ce.status = 'completed'
    and ce.lead_id is not null
  group by ce.lead_id
)
select
  l.id as lead_id,
  l.owner_user_id,
  c.presentation_at,
  l.cerrado_at as won_at,
  (floor(extract(epoch from (l.cerrado_at - c.presentation_at)) / 86400))::integer as days_to_won
from public.leads l
join public.pipeline_stages s on s.id = l.stage_id and s.slug = 'casos_ganados'
join closing_before_won c on c.lead_id = l.id
where l.cerrado_at is not null;
