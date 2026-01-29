-- ============================================================
-- Productividad semanal: entradas por etapa (lunes→lunes)
-- Fuente: lead_stage_history (existente). No se crea tabla nueva.
-- Cuenta máx. 1 por (lead_id, to_stage_id) por semana.
-- TZ: America/Monterrey para la semana.
-- ============================================================

-- RPC: entradas a etapa por semana (week_start = lunes; week_end = week_start + 7, exclusivo)
-- changed_at = COALESCE(occurred_at, moved_at)
create or replace function public.get_weekly_pipeline_entries(p_week_start date)
returns table(week_start date, week_end date, slug text, count bigint)
language sql
stable
security invoker
as $$
  select
    p_week_start as week_start,
    p_week_start + 7 as week_end,
    s.slug,
    count(*)::bigint
  from (
    select distinct h.lead_id, h.to_stage_id
    from public.lead_stage_history h
    inner join public.leads l on l.id = h.lead_id and l.owner_user_id = auth.uid()
    where (coalesce(h.occurred_at, h.moved_at) at time zone 'America/Monterrey')::date >= p_week_start
      and (coalesce(h.occurred_at, h.moved_at) at time zone 'America/Monterrey')::date < p_week_start + 7
  ) sub
  inner join public.pipeline_stages s on s.id = sub.to_stage_id
  group by s.slug, s.position
  order by s.position;
$$;

comment on function public.get_weekly_pipeline_entries(date) is
  'Entradas a etapa por semana (lunes→lunes). Cuenta 1 por lead+etapa por semana. TZ America/Monterrey.';

grant execute on function public.get_weekly_pipeline_entries(date) to authenticated;

-- Ejemplo: semana actual (lunes en America/Monterrey)
--   select * from public.get_weekly_pipeline_entries(
--     (date_trunc('week', (now() at time zone 'America/Monterrey')::timestamptz))::date
--   );
-- Ejemplo: lunes concreto
--   select * from public.get_weekly_pipeline_entries('2026-01-27'::date);
