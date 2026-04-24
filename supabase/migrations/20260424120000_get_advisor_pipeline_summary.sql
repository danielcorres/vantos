-- Resumen de pipeline por asesor (snapshot + entradas semanales) para Manager/Owner/Director/Seguimiento.
-- security definer: lectura cross-user; autorización explícita en el cuerpo.

begin;

create or replace function public.get_advisor_pipeline_summary(
  p_user_id uuid,
  p_week_start date
)
returns table (
  slug text,
  stage_name text,
  stage_position int,
  current_count bigint,
  week_entries bigint
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if p_user_id is null then
    raise exception 'p_user_id es obligatorio';
  end if;

  if not (
    public.can_assign_roles()
    or public.is_seguimiento()
    or (
      public.is_manager()
      and exists (
        select 1
        from public.profiles p
        where p.user_id = p_user_id
          and p.role = 'advisor'
          and p.manager_user_id = auth.uid()
      )
    )
  ) then
    raise exception 'No autorizado para ver el pipeline de este asesor';
  end if;

  return query
  with snapshot as (
    select l.stage_id, count(*)::bigint as cnt
    from public.leads l
    where l.owner_user_id = p_user_id
      and l.archived_at is null
    group by l.stage_id
  ),
  weekly as (
    select distinct h.lead_id, h.to_stage_id
    from public.lead_stage_history h
    inner join public.leads l
      on l.id = h.lead_id
      and l.owner_user_id = p_user_id
    where not coalesce(h.is_retroceso, false)
      and (coalesce(h.occurred_at, h.moved_at) at time zone 'America/Monterrey')::date >= p_week_start
      and (coalesce(h.occurred_at, h.moved_at) at time zone 'America/Monterrey')::date < p_week_start + 7
  ),
  weekly_agg as (
    select to_stage_id, count(*)::bigint as cnt
    from weekly
    group by to_stage_id
  )
  select
    s.slug,
    s.name as stage_name,
    s.position as stage_position,
    coalesce(sn.cnt, 0::bigint) as current_count,
    coalesce(wa.cnt, 0::bigint) as week_entries
  from public.pipeline_stages s
  left join snapshot sn on sn.stage_id = s.id
  left join weekly_agg wa on wa.to_stage_id = s.id
  where s.is_active = true
  order by s.position;
end;
$function$;

comment on function public.get_advisor_pipeline_summary(uuid, date) is
  'Por etapa: conteo de leads activos del asesor y entradas a etapa en la semana (lunes→lunes, TZ America/Monterrey). Excluye retrocesos. Solo owner/director, seguimiento o manager del asesor.';

grant execute on function public.get_advisor_pipeline_summary(uuid, date) to authenticated;

commit;
