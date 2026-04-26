-- ============================================================
-- VANT · Módulo Campañas — Seed de desarrollo y pruebas
--
-- ⚠ ESTE ARCHIVO NO ES UNA MIGRACIÓN.
-- ⚠ NO se aplica automáticamente con `supabase db push`.
-- ⚠ NO ejecutar en producción.
--
-- Solo para uso en entornos locales o staging controlados.
-- Ejecutar manualmente cuando se necesite poblar datos de prueba:
--
--   psql "$DATABASE_URL" -f supabase/dev-seeds/campaigns_dev_seed.sql
--
--   o desde Supabase local:
--
--   supabase db execute --file supabase/dev-seeds/campaigns_dev_seed.sql
--
-- Requiere que las migraciones reales ya estén aplicadas:
--   1. 20260501120000_campaigns_module.sql
--   2. 20260501130000_campaigns_rpcs.sql
--
-- Contiene 3 campañas de ejemplo:
--   1. Fan Fest          → fixed_period (campaña temporal con inicio/fin)
--   2. Camino a la Cumbre → new_advisor_path (carrera de asesor)
--   3. Legión Centurión  → multi_track (estructura + tracks, sin niveles)
--
-- Usa UUIDs fijos (prefijo a1000000-) para idempotencia.
-- No crea usuarios, profiles ni snapshots reales.
-- No hay tablas específicas por campaña: todo es configuración genérica.
-- No se usa organization_id.
-- ============================================================

begin;

do $$
declare
  -- UUIDs fijos para seed dev
  v_fan_fest_id       constant uuid := 'a1000000-0000-0000-0000-000000000001';
  v_cumbre_id         constant uuid := 'a1000000-0000-0000-0000-000000000002';
  v_legion_id         constant uuid := 'a1000000-0000-0000-0000-000000000003';

  v_track_vida_id     constant uuid := 'a1000000-0000-0000-0000-000000000010';
  v_track_gmmi_id     constant uuid := 'a1000000-0000-0000-0000-000000000011';
  v_track_momentum_id constant uuid := 'a1000000-0000-0000-0000-000000000012';
  v_track_grupo_id    constant uuid := 'a1000000-0000-0000-0000-000000000013';
begin

  -- ──────────────────────────────────────────────────────────
  -- 1) Fan Fest — campaña temporal de pólizas (fixed_period)
  --    Tipo: fixed_period (no 'monthly')
  --    Fan Fest es una campaña con fecha inicio y fin definida,
  --    no recurrente. No requiere tabla propia.
  -- ──────────────────────────────────────────────────────────
  insert into public.campaigns (
    id, slug, name, description,
    metric_type, unit_label, campaign_type,
    color, sort_order, is_active
  ) values (
    v_fan_fest_id,
    'fan_fest',
    'Fan Fest',
    'Campaña temporal de pólizas con meta única.',
    'polizas',
    'pólizas',
    'fixed_period',
    '#3B82F6',
    10,
    true
  ) on conflict (slug) do nothing;

  -- Nivel único: meta de 10 pólizas
  insert into public.campaign_levels (
    campaign_id, name, level_order, target_value,
    badge_label, reward_is_active, evaluation_period_type
  )
  select
    v_fan_fest_id, 'Meta Fan Fest', 1, 10,
    'Fan Fest', true, 'monthly'
  where not exists (
    select 1 from public.campaign_levels cl2
    where cl2.campaign_id = v_fan_fest_id
      and cl2.level_order = 1
  );

  -- ──────────────────────────────────────────────────────────
  -- 2) Camino a la Cumbre — carrera de asesor (new_advisor_path)
  --    Elegibilidad: asesores con menos de 18 meses de antigüedad.
  --    Meses de inicio calculados desde connection_date.
  --
  --    Reglas de requires_monthly_minimum:
  --    · Kubor       (mes 3)  → true  (requiere mínimo mensual)
  --    · Mont Blanc  (mes 6)  → false
  --    · Elbrús      (mes 9)  → false
  --    · McKinley    (mes 12) → false
  --    · Kilimanjaro (mes 15) → false
  --    · Everest     (mes 18) → false
  -- ──────────────────────────────────────────────────────────
  insert into public.campaigns (
    id, slug, name, description,
    metric_type, unit_label, campaign_type,
    duration_months, eligibility_basis,
    rules_summary, color, sort_order, is_active
  ) values (
    v_cumbre_id,
    'camino_a_la_cumbre',
    'Camino a la Cumbre',
    'Carrera para nuevos asesores durante sus primeros 18 meses.',
    'polizas',
    'pólizas',
    'new_advisor_path',
    18,
    'connection_date',
    'Campaña permanente para nuevos asesores. Los premios están sujetos a validación administrativa y bases oficiales.',
    '#10B981',
    20,
    true
  ) on conflict (slug) do nothing;

  -- Insertar niveles individualmente para controlar requires_monthly_minimum por nivel
  insert into public.campaign_levels (
    campaign_id, name, level_order, target_value, badge_label,
    target_month, requires_monthly_minimum, reward_is_active, evaluation_period_type
  )
  select v_cumbre_id, lvl.lname, lvl.ord, lvl.target, lvl.badge,
         lvl.tmonth, lvl.req_min, true, 'monthly'
  from (values
    -- (nombre, orden, meta_polizas, badge, mes_objetivo, requires_monthly_minimum)
    ('Kubor',       1, 12,  'Kubor',       3,  true),
    ('Mont Blanc',  2, 24,  'Mont Blanc',  6,  false),
    ('Elbrús',      3, 36,  'Elbrús',      9,  false),
    ('McKinley',    4, 48,  'McKinley',   12,  false),
    ('Kilimanjaro', 5, 60,  'Kilimanjaro', 15, false),
    ('Everest',     6, 72,  'Everest',    18,  false)
  ) as lvl(lname, ord, target, badge, tmonth, req_min)
  where not exists (
    select 1 from public.campaign_levels cl2
    where cl2.campaign_id = v_cumbre_id
      and cl2.level_order = lvl.ord
  );

  -- ──────────────────────────────────────────────────────────
  -- 3) Legión Centurión — multi_track
  --    Solo se crea la campaña y los 4 tracks.
  --    Los niveles NO se crean en dev seed:
  --    las metas reales de Legión Centurión requieren datos
  --    oficiales de cada camino y no deben insertarse con
  --    valores aproximados/incompletos.
  -- ──────────────────────────────────────────────────────────
  insert into public.campaigns (
    id, slug, name, description,
    metric_type, unit_label, campaign_type,
    rewards_are_cumulative, max_rewards_per_period,
    color, sort_order, is_active
  ) values (
    v_legion_id,
    'legion_centurion',
    'Legión Centurión',
    'Campaña anual con múltiples caminos de participación.',
    'polizas',
    'pólizas',
    'multi_track',
    false,
    1,
    '#8B5CF6',
    30,
    true
  ) on conflict (slug) do nothing;

  -- Tracks (caminos)
  insert into public.campaign_tracks (id, campaign_id, slug, name, sort_order)
  values
    (v_track_vida_id,     v_legion_id, 'vida_gmmi',       'Vida & GMMI',       1),
    (v_track_gmmi_id,     v_legion_id, 'gmmi',            'GMMI',              2),
    (v_track_momentum_id, v_legion_id, 'momentum',        'Momentum',          3),
    (v_track_grupo_id,    v_legion_id, 'grupo_colectivo', 'Grupo & Colectivo', 4)
  on conflict (campaign_id, slug) do nothing;

  -- Niveles de Legión Centurión NO se incluyen en seed.
  -- Configurar desde la UI en /indicadores/config/niveles/{id}
  -- o crear una migración separada con datos oficiales validados.

end $$;

commit;
