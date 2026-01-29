-- ============================================================
-- Productividad: drill-down por etapa — leads que entraron
-- RPC: listado de leads (1 por lead+etapa en la semana)
-- TZ: America/Monterrey. Scope: owner_user_id = auth.uid()
-- ============================================================

create or replace function public.get_weekly_pipeline_entries_leads(
  p_week_start date,
  p_stage_slug text
)
returns table (
  lead_id uuid,
  lead_name text,
  next_follow_up_at date,
  source text,
  moved_at timestamptz,
  stage_slug text
)
language sql
stable
security invoker
as $$
  with entry as (
    select
      h.lead_id,
      min(coalesce(h.occurred_at, h.moved_at)) as moved_at
    from public.lead_stage_history h
    inner join public.leads l on l.id = h.lead_id and l.owner_user_id = auth.uid()
    inner join public.pipeline_stages s on s.id = h.to_stage_id and s.slug = p_stage_slug
    where (coalesce(h.occurred_at, h.moved_at) at time zone 'America/Monterrey')::date >= p_week_start
      and (coalesce(h.occurred_at, h.moved_at) at time zone 'America/Monterrey')::date < p_week_start + 7
    group by h.lead_id
  )
  select
    e.lead_id,
    l.full_name as lead_name,
    l.next_follow_up_at,
    l.source,
    e.moved_at,
    p_stage_slug as stage_slug
  from entry e
  inner join public.leads l on l.id = e.lead_id
  order by e.moved_at asc
  limit 200;
$$;

comment on function public.get_weekly_pipeline_entries_leads(date, text) is
  'Leads que entraron a la etapa en la semana (1 por lead, MIN timestamp). TZ America/Monterrey. RLS vía owner_user_id.';

grant execute on function public.get_weekly_pipeline_entries_leads(date, text) to authenticated;
