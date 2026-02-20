-- ============================================================
-- Verificación manual: conteos por slug de leads activos
-- (debe coincidir con "Mi Embudo" en Pipeline: Inventario hoy + Avance hoy)
-- Ejecutar como usuario autenticado o reemplazar auth.uid() por un owner_user_id.
-- ============================================================

-- Conteos por slug (solo leads con archived_at IS NULL)
select
  s.slug,
  count(l.id) as leads_count
from public.leads l
inner join public.pipeline_stages s on s.id = l.stage_id
where l.owner_user_id = auth.uid()
  and l.archived_at is null
  and s.slug in (
    'contactos_nuevos',
    'citas_agendadas',
    'solicitudes_ingresadas',
    'casos_abiertos',
    'citas_cierre',
    'casos_ganados'
  )
group by s.slug
order by s.slug;
