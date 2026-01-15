-- ============================================================
-- Create v_lead_sla_alerts (minimal) + apply get_today_focus
-- ============================================================

begin;

-- Minimal SLA view so get_today_focus can compile.
-- TODO: refine SLA logic using stage SLA settings once confirmed.
create or replace view public.v_lead_sla_alerts as
select
  l.id as lead_id,
  'ok'::text as sla_status,
  greatest(
    0,
    floor(extract(epoch from (now() - coalesce(l.updated_at, l.created_at))) / 86400)
  )::int as days_in_stage,
  coalesce(l.updated_at, l.created_at) as entered_stage_at
from public.leads l;


-- Now that view exists, re-apply function (same definition as before)
create or replace function public.get_today_focus(p_limit integer default 25)
returns table (
  lead_id uuid,
  full_name text,
  stage_id uuid,
  stage_name text,
  sla_status text,
  days_in_stage int,
  entered_stage_at timestamptz,
  last_activity_at timestamptz,
  priority_score int,
  reason text
)
language sql
security definer
set search_path = public
as $$
with base as (
  select
    a.lead_id,
    l.full_name,
    l.stage_id,
    s.name as stage_name,
    a.sla_status,
    a.days_in_stage,
    a.entered_stage_at,
    (
      select max(e.recorded_at)
      from public.activity_events e
      where e.actor_user_id = auth.uid()
        and e.lead_id = l.id
        and coalesce(e.is_void, false) = false
    ) as last_activity_at
  from public.v_lead_sla_alerts a
  join public.leads l on l.id = a.lead_id
  join public.pipeline_stages s on s.id = l.stage_id
  where l.owner_user_id = auth.uid()
),
scored as (
  select
    *,
    (
      case
        when sla_status = 'breach' then 1000
        when sla_status = 'warn' then 700
        else 0
      end
      + least(days_in_stage, 60) * 5
      + case
          when last_activity_at is null then 200
          when last_activity_at < (now() - interval '3 days') then 150
          when last_activity_at < (now() - interval '1 day') then 50
          else 0
        end
    )::int as priority_score,
    case
      when sla_status = 'breach' then 'SLA vencido en etapa'
      when sla_status = 'warn' then 'SLA por vencer'
      when last_activity_at is null then 'Sin actividad registrada'
      when last_activity_at < (now() - interval '3 days') then 'Sin actividad en 3+ días'
      when last_activity_at < (now() - interval '1 day') then 'Sin actividad desde ayer'
      else 'Seguimiento recomendado'
    end as reason
  from base
)
select
  lead_id,
  full_name,
  stage_id,
  stage_name,
  sla_status,
  days_in_stage,
  entered_stage_at,
  last_activity_at,
  priority_score,
  reason
from scored
order by priority_score desc, last_activity_at nulls first, entered_stage_at asc
limit greatest(1, p_limit);
$$;

grant execute on function public.get_today_focus(integer) to authenticated;

commit;
