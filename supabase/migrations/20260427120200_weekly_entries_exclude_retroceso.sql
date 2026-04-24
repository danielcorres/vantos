-- Excluir movimientos marcados como retroceso del conteo semanal y del drill-down.

begin;

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
    where not coalesce(h.is_retroceso, false)
      and (coalesce(h.occurred_at, h.moved_at) at time zone 'America/Monterrey')::date >= p_week_start
      and (coalesce(h.occurred_at, h.moved_at) at time zone 'America/Monterrey')::date < p_week_start + 7
  ) sub
  inner join public.pipeline_stages s on s.id = sub.to_stage_id
  group by s.slug, s.position
  order by s.position;
$$;

comment on function public.get_weekly_pipeline_entries(date) is
  'Entradas a etapa por semana (lunes→lunes). Cuenta 1 por lead+etapa por semana. Excluye is_retroceso. TZ America/Monterrey.';

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
    where not coalesce(h.is_retroceso, false)
      and (coalesce(h.occurred_at, h.moved_at) at time zone 'America/Monterrey')::date >= p_week_start
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
  'Leads que entraron a la etapa en la semana (1 por lead, MIN timestamp). Excluye is_retroceso. TZ America/Monterrey.';

commit;
