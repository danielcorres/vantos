-- ============================================================
-- Resultados del mes: conteos por entrada a etapas clave (Insights).
-- Cuenta entradas a casos_abiertos, citas_cierre, casos_ganados en el mes.
-- TZ: America/Monterrey. RLS: owner_user_id = auth.uid().
-- ============================================================

create or replace function public.get_monthly_production_counts(
  p_year int,
  p_month int
)
returns table (
  slug text,
  count bigint
)
language sql
stable
security invoker
as $$
  with params as (
    select
      (p_year || '-' || lpad(p_month::text, 2, '0') || '-01')::date as month_start,
      ((p_year || '-' || lpad(p_month::text, 2, '0') || '-01')::date + interval '1 month')::date as month_end
  ),
  events as (
    select
      s.slug,
      h.lead_id
    from public.lead_stage_history h
    inner join public.leads l on l.id = h.lead_id and l.owner_user_id = auth.uid()
    inner join public.pipeline_stages s on s.id = h.to_stage_id
      and s.slug in ('casos_abiertos', 'citas_cierre', 'casos_ganados')
    cross join params
    where ((coalesce(h.occurred_at, h.moved_at) at time zone 'America/Monterrey')::date >= params.month_start)
      and ((coalesce(h.occurred_at, h.moved_at) at time zone 'America/Monterrey')::date < params.month_end)
  )
  select e.slug, count(*)::bigint
  from events e
  group by e.slug;
$$;

comment on function public.get_monthly_production_counts(int, int) is
  'Conteos de entradas a casos_abiertos, citas_cierre, casos_ganados en el mes. Para Insights > Resultados del mes. RLS vía owner_user_id.';

grant execute on function public.get_monthly_production_counts(int, int) to authenticated;
