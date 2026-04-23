-- Resumen de citas por lead para UX (Kanban/lista) sin exponer tokens.
create or replace function public.get_calendar_scheduling_summaries(p_lead_ids uuid[])
returns table (
  lead_id uuid,
  has_completed_first boolean,
  has_completed_closing boolean,
  next_scheduled_id uuid,
  next_scheduled_starts_at timestamptz,
  next_scheduled_type text
)
language sql
stable
security invoker
set search_path = public
as $$
  with ids as (
    select unnest(coalesce(p_lead_ids, array[]::uuid[])) as lead_id
  ),
  ev as (
    select ce.*
    from public.calendar_events ce
    inner join ids i on i.lead_id = ce.lead_id
    where ce.owner_user_id = auth.uid()
  ),
  agg as (
    select
      e.lead_id,
      bool_or(e.status = 'completed' and e.type = 'first_meeting') as hcf,
      bool_or(e.status = 'completed' and e.type = 'closing') as hcc
    from ev e
    group by e.lead_id
  ),
  ranked as (
    select
      e.lead_id,
      e.id as eid,
      e.starts_at as estarts,
      e.type::text as etype,
      row_number() over (partition by e.lead_id order by e.starts_at asc) as rn
    from ev e
    where e.status = 'scheduled'
      and e.starts_at >= now()
  ),
  nxt as (
    select lead_id, eid, estarts, etype
    from ranked
    where rn = 1
  )
  select
    i.lead_id,
    coalesce(a.hcf, false),
    coalesce(a.hcc, false),
    n.eid,
    n.estarts,
    n.etype
  from ids i
  left join agg a on a.lead_id = i.lead_id
  left join nxt n on n.lead_id = i.lead_id;
$$;

grant execute on function public.get_calendar_scheduling_summaries(uuid[]) to authenticated;
