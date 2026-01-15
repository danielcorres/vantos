create or replace function public.get_pipeline_board()
returns table (
  lead_id uuid,
  lead_name text,
  stage_id uuid,
  stage_name text,
  entered_at timestamptz,
  sla_enabled boolean,
  sla_days int,
  sla_warn_days int,
  sla_due_at date,
  sla_days_left int,
  sla_state text,
  sla_priority int
)
language sql
stable
security definer
as $$
  with latest_move as (
    select distinct on (h.lead_id)
      h.lead_id,
      h.to_stage_id as stage_id,
      h.moved_at as entered_at
    from public.lead_stage_history h
    order by h.lead_id, h.moved_at desc
  ),
  base as (
    select
      l.id as lead_id,
      l.full_name as lead_name,
      coalesce(lm.stage_id, l.stage_id) as stage_id,
      coalesce(lm.entered_at, l.stage_changed_at, l.created_at) as entered_at,
      ps.name as stage_name,
      ps.sla_enabled,
      ps.sla_days,
      ps.sla_warn_days
    from public.leads l
    left join latest_move lm on lm.lead_id = l.id
    left join public.pipeline_stages ps on ps.id = coalesce(lm.stage_id, l.stage_id)
  ),
  calc as (
    select
      b.*,
      case
        when b.sla_enabled is true and b.sla_days is not null and b.entered_at is not null
          then ((b.entered_at at time zone 'America/Monterrey')::date + b.sla_days)
        else null
      end as sla_due_at
    from base b
  )
  select
    c.lead_id,
    c.lead_name,
    c.stage_id,
    c.stage_name,
    c.entered_at,
    c.sla_enabled,
    c.sla_days,
    c.sla_warn_days,
    c.sla_due_at,
    case
      when c.sla_due_at is null then null
      else (c.sla_due_at - (now() at time zone 'America/Monterrey')::date)
    end as sla_days_left,
    case
      when c.sla_due_at is null then null
      when (c.sla_due_at - (now() at time zone 'America/Monterrey')::date) < 0 then 'overdue'
      when c.sla_warn_days is not null
           and (c.sla_due_at - (now() at time zone 'America/Monterrey')::date) <= c.sla_warn_days then 'warn'
      else 'ok'
    end as sla_state,
    case
      when c.sla_due_at is null then 30
      when (c.sla_due_at - (now() at time zone 'America/Monterrey')::date) < 0 then 0
      when c.sla_warn_days is not null
           and (c.sla_due_at - (now() at time zone 'America/Monterrey')::date) <= c.sla_warn_days then 1
      else 2
    end as sla_priority
  from calc c;
$$;

grant execute on function public.get_pipeline_board() to authenticated;
