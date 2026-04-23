-- calendar_events.type: call | message | meeting | other (UI: Llamada, Mensaje, Reunión, Otro)
-- Migra first_meeting/closing → meeting, follow_up → message; actualiza CHECK, RPC y vista KPI.
--
-- Importante: hay que DROP del CHECK *antes* de los UPDATE. Si no, Postgres sigue aplicando el
-- CHECK antiguo (solo first_meeting|closing|follow_up) y rechaza type = 'meeting'.

-- 1) Quitar restricción antigua para poder escribir los nuevos valores
alter table public.calendar_events
  drop constraint if exists calendar_events_type_check;

-- 2) Migrar datos legacy (y cualquier valor fuera del nuevo conjunto → other)
update public.calendar_events
set type = 'meeting'
where type in ('first_meeting', 'closing');

update public.calendar_events
set type = 'message'
where type = 'follow_up';

update public.calendar_events
set type = 'other'
where type is not null
  and type not in ('call', 'message', 'meeting', 'other');

-- 3) Nuevo CHECK
alter table public.calendar_events
  add constraint calendar_events_type_check
  check (type in ('call', 'message', 'meeting', 'other'));

comment on column public.calendar_events.type is 'Canal de la cita: call | message | meeting | other';

-- 4) RPC: resumen por lead (hitos y próxima cita programada)
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
      bool_or(e.status = 'completed' and e.type in ('meeting', 'call')) as hcf,
      bool_or(e.status = 'completed' and e.type = 'meeting') as hcc
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

-- 5) Vista KPI: última reunión completada antes de ganar (antes type = closing)
create or replace view public.pipeline_kpi_close_to_won as
with closing_before_won as (
  select
    ce.lead_id,
    max(ce.ends_at) as presentation_at
  from public.calendar_events ce
  inner join public.leads l on l.id = ce.lead_id and l.cerrado_at is not null and ce.ends_at <= l.cerrado_at
  inner join public.pipeline_stages s on s.id = l.stage_id and s.slug = 'casos_ganados'
  where ce.type = 'meeting'
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

comment on view public.pipeline_kpi_close_to_won is 'KPI días reunión completada (type=meeting) → ganado; antes solo type=closing.';

grant execute on function public.get_calendar_scheduling_summaries(uuid[]) to authenticated;
