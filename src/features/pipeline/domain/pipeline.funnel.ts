/**
 * Dominio: Mi Embudo — solo stock por etapa actual (Inventario hoy + Avance hoy).
 * Coincide con la tabla por etapas: conteo por stage_id/slug de leads activos.
 */

export type FunnelStatus = 'green' | 'amber' | 'red'

export type FunnelMetricKind = 'inventario' | 'avance'

export type FunnelMetricStatus = {
  slug: string
  label: string
  value: number
  target: number
  status: FunnelStatus
  kind: FunnelMetricKind
}

interface LeadLike {
  stage_id: string
}

interface StageLike {
  id: string
  slug: string
}

const INVENTORY_SLUGS: readonly string[] = [
  'contactos_nuevos',
  'citas_agendadas',
  'solicitudes_ingresadas',
]

const AVANCE_SLUGS: readonly string[] = [
  'casos_abiertos',
  'citas_cierre',
  'casos_ganados',
]

const SLUG_LABELS: Record<string, string> = {
  contactos_nuevos: 'Pendiente de cita',
  citas_agendadas: 'Cita agendada',
  solicitudes_ingresadas: 'En trámite',
  casos_abiertos: 'Primera cita',
  citas_cierre: 'Cita de cierre',
  casos_ganados: 'Póliza activa',
}

const ALL_SLUGS = [...INVENTORY_SLUGS, ...AVANCE_SLUGS]

/** Metas de stock (ambas filas: Inventario hoy y Avance hoy). */
const META: Record<string, { target: number; kind: FunnelMetricKind }> = {
  contactos_nuevos: { target: 30, kind: 'inventario' },
  citas_agendadas: { target: 10, kind: 'inventario' },
  solicitudes_ingresadas: { target: 2, kind: 'inventario' },
  casos_abiertos: { target: 8, kind: 'avance' },
  citas_cierre: { target: 5, kind: 'avance' },
  casos_ganados: { target: 4, kind: 'avance' },
}

/**
 * Conteos por slug (cuántos leads están AHORA en esa etapa).
 */
export function getStageCounts(
  leads: LeadLike[],
  stages: StageLike[]
): Record<string, number> {
  const slugById = new Map<string, string>()
  for (const s of stages) {
    slugById.set(s.id, s.slug)
  }
  const counts: Record<string, number> = {}
  for (const slug of ALL_SLUGS) {
    counts[slug] = 0
  }
  for (const lead of leads) {
    const slug = slugById.get(lead.stage_id)
    if (slug && slug in counts) {
      counts[slug]++
    }
  }
  return counts
}

/**
 * Estado de semáforo para una métrica de stock.
 * - Verde si value >= meta.
 * - Ámbar si value >= 80% de meta (excepto En trámite: solo rojo/verde).
 * - Rojo si está lejos.
 */
function statusForStock(
  slug: string,
  value: number,
  target: number
): FunnelStatus {
  if (slug === 'solicitudes_ingresadas') {
    return value >= target ? 'green' : 'red'
  }
  const pct = target > 0 ? value / target : 0
  if (pct >= 1) return 'green'
  if (pct >= 0.8) return 'amber'
  return 'red'
}

/**
 * Statuses para las 6 etapas (Inventario hoy + Avance hoy) a partir de conteos.
 * Solo stock; sin métricas mensuales ni pace.
 */
export function computeStockStatus(
  counts: Record<string, number>
): FunnelMetricStatus[] {
  const result: FunnelMetricStatus[] = []
  for (const slug of ALL_SLUGS) {
    const conf = META[slug]
    if (!conf) continue
    const value = counts[slug] ?? 0
    const label = SLUG_LABELS[slug] ?? slug
    const target = conf.target
    const status = statusForStock(slug, value, target)
    result.push({ slug, label, value, target, status, kind: conf.kind })
  }
  return result
}

/** Prioridad para acción recomendada: solo Inventario hoy (3 slugs). */
const SUGGESTION_PRIORITY: readonly string[] = [
  'solicitudes_ingresadas',
  'citas_agendadas',
  'contactos_nuevos',
]

const SUGGESTION_MESSAGES: Record<string, string> = {
  solicitudes_ingresadas: 'Prioriza 1 solicitud hoy.',
  citas_agendadas: 'Convierte 2 contactos en citas.',
  contactos_nuevos: 'Agrega 3 nuevos contactos hoy.',
}

/**
 * Una sola recomendación: la de mayor prioridad entre las que están en rojo.
 * Solo considera métricas de Inventario hoy (kind === 'inventario').
 */
export function pickPrimarySuggestion(
  statuses: FunnelMetricStatus[]
): { statusKey: string; message: string } | null {
  const inventarioStatuses = statuses.filter((s) => s.kind === 'inventario')
  for (const key of SUGGESTION_PRIORITY) {
    const st = inventarioStatuses.find((s) => s.slug === key && s.status === 'red')
    if (st) {
      const message = SUGGESTION_MESSAGES[key] ?? `Refuerza ${st.label}.`
      return { statusKey: key, message }
    }
  }
  return null
}

export function isAllGreen(statuses: FunnelMetricStatus[]): boolean {
  return statuses.every((s) => s.status === 'green')
}
