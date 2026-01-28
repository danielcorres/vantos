-- ============================================================
-- PIPELINE V3 – Sales Funnel (Calendar-ready)
-- Fixes:
-- - Adds stable slug to pipeline_stages
-- - Avoids position conflicts (uses 110..160)
-- - Aligns stages to 6-column business funnel
-- - Backfills leads safely
-- ============================================================

-- ------------------------------------------------------------
-- 0) Add slug column to pipeline_stages (stable key for frontend)
-- ------------------------------------------------------------
alter table public.pipeline_stages
  add column if not exists slug text;

-- Backfill slug for existing stages (legacy)
update public.pipeline_stages
set slug = case name
  when 'Nuevo' then 'legacy_nuevo'
  when 'Contactado' then 'legacy_contactado'
  when 'Cita agendada' then 'legacy_cita_agendada'
  when 'Cita realizada' then 'legacy_cita_realizada'
  when 'Propuesta' then 'legacy_propuesta_presentada'
  when 'Cerrado ganado' then 'legacy_cerrado_ganado'
  when 'Cerrado perdido' then 'legacy_cerrado_perdido'
  when 'Cerrado' then 'legacy_cerrado'
  else coalesce(slug, 'legacy_' || lower(replace(name,' ','_')))
end
where slug is null;

-- Enforce slug not null
alter table public.pipeline_stages
  alter column slug set not null;

-- Unique index for slug (idempotent)
do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and indexname = 'pipeline_stages_slug_key'
  ) then
    create unique index pipeline_stages_slug_key
      on public.pipeline_stages(slug);
  end if;
end $$;

-- ------------------------------------------------------------
-- 1) Calendar-ready milestone fields on leads
-- ------------------------------------------------------------
alter table public.leads
  add column if not exists cita_agendada_at timestamptz null,
  add column if not exists cita_cierre_at timestamptz null,
  add column if not exists solicitud_ingresada_at timestamptz null,
  add column if not exists paid_at timestamptz null;

-- ------------------------------------------------------------
-- 2) Insert OFFICIAL V3 pipeline stages (safe positions)
--    Uses 110..160 to avoid unique(position) conflicts
-- ------------------------------------------------------------
insert into public.pipeline_stages (id, name, slug, position, is_active)
select gen_random_uuid(), v.name, v.slug, v.position, true
from (values
  ('Contactos Nuevos',        'contactos_nuevos',        110),
  ('Citas Agendadas',         'citas_agendadas',         120),
  ('Casos Abiertos',          'casos_abiertos',          130),
  ('Citas de Cierre',         'citas_cierre',            140),
  ('Solicitudes Ingresadas',  'solicitudes_ingresadas',  150),
  ('Casos Ganados',           'casos_ganados',           160)
) as v(name, slug, position)
where not exists (
  select 1
  from public.pipeline_stages s
  where s.slug = v.slug
);

-- ------------------------------------------------------------
-- 3) Backfill leads.stage_id -> V3 stages
-- ------------------------------------------------------------

-- Nuevo + Contactado -> Contactos Nuevos
update public.leads l
set stage_id = (
      select id from public.pipeline_stages where slug = 'contactos_nuevos'
    ),
    stage_changed_at = coalesce(stage_changed_at, now())
where l.stage_id in (
  select id
  from public.pipeline_stages
  where slug in ('legacy_nuevo', 'legacy_contactado')
);

-- Cita agendada -> Citas Agendadas
update public.leads l
set stage_id = (
      select id from public.pipeline_stages where slug = 'citas_agendadas'
    ),
    stage_changed_at = coalesce(stage_changed_at, now())
where l.stage_id in (
  select id
  from public.pipeline_stages
  where slug = 'legacy_cita_agendada'
);

-- Cita realizada + Propuesta presentada -> Casos Abiertos
update public.leads l
set stage_id = (
      select id from public.pipeline_stages where slug = 'casos_abiertos'
    ),
    stage_changed_at = coalesce(stage_changed_at, now())
where l.stage_id in (
  select id
  from public.pipeline_stages
  where slug in ('legacy_cita_realizada', 'legacy_propuesta_presentada')
);

-- Cerrado ganado -> Casos Ganados
update public.leads l
set stage_id = (
      select id from public.pipeline_stages where slug = 'casos_ganados'
    ),
    stage_changed_at = coalesce(stage_changed_at, now())
where l.stage_id in (
  select id
  from public.pipeline_stages
  where slug = 'legacy_cerrado_ganado'
);

-- Cerrado perdido -> Archive (out of funnel)
update public.leads l
set archived_at = coalesce(archived_at, now()),
    archive_reason = coalesce(archive_reason, 'Perdido'),
    stage_changed_at = coalesce(stage_changed_at, now())
where l.stage_id in (
  select id
  from public.pipeline_stages
  where slug = 'legacy_cerrado_perdido'
);

-- ------------------------------------------------------------
-- 4) Deactivate legacy stages (prevents UI confusion)
-- ------------------------------------------------------------
update public.pipeline_stages
set is_active = false
where slug like 'legacy_%';

-- Optional: rename legacy Propuesta for clarity (inactive anyway)
update public.pipeline_stages
set name = 'Propuesta presentada'
where slug = 'legacy_propuesta_presentada';

-- ============================================================
-- END PIPELINE V3
-- ============================================================
