/**
 * Dominio: estado del embudo (Mi Embudo — Mes Actual).
 * Métricas por slug, semáforo y acción recomendada. Sin DB; solo funciones puras.
 */

export type FunnelStatus = 'green' | 'amber' | 'red'

export type FunnelMetricKind = 'stock' | 'monthly'

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

const FUNNEL_SLUGS_ORDER: readonly string[] = [
  'contactos_nuevos',
  'citas_agendadas',
  'casos_abiertos',
  'citas_cierre',
  'solicitudes_ingresadas',
  'casos_ganados',
]

const SLUG_LABELS: Record<string, string> = {
  contactos_nuevos: 'Pend. cita',
  citas_agendadas: 'Cita agend.',
  casos_abiertos: '1ª cita',
  citas_cierre: 'Cierre',
  solicitudes_ingresadas: 'Trámite',
  casos_ganados: 'Póliza',
}

/** Stock: meta fija. Monthly: meta prorrateada por día del mes. */
const META: Record<string, { target: number; kind: FunnelMetricKind }> = {
  contactos_nuevos: { target: 30, kind: 'stock' },
  citas_agendadas: { target: 10, kind: 'stock' },
  solicitudes_ingresadas: { target: 2, kind: 'stock' },
  casos_abiertos: { target: 8, kind: 'monthly' },
  citas_cierre: { target: 5, kind: 'monthly' },
  casos_ganados: { target: 4, kind: 'monthly' },
}

/**
 * Conteos por slug (usa lead.stage_id → stage.slug).
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
  for (const slug of FUNNEL_SLUGS_ORDER) {
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

function getExpectedMonthly(meta: number, now: Date): number {
  const day = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const expected = meta * (day / daysInMonth)
  return expected < 1 ? 1 : expected
}

/**
 * Estado por métrica: value, target, status (green/amber/red), label, kind.
 */
export function computeFunnelStatus(
  counts: Record<string, number>,
  nowDate: Date = new Date()
): FunnelMetricStatus[] {
  const result: FunnelMetricStatus[] = []

  for (const slug of FUNNEL_SLUGS_ORDER) {
    const conf = META[slug]
    if (!conf) continue
    const value = counts[slug] ?? 0
    const label = SLUG_LABELS[slug] ?? slug

    if (conf.kind === 'stock') {
      const target = conf.target
      let status: FunnelStatus
      if (slug === 'solicitudes_ingresadas') {
        status = value >= target ? 'green' : 'red'
      } else if (slug === 'contactos_nuevos') {
        status = value >= 30 ? 'green' : value >= 24 ? 'amber' : 'red'
      } else {
        status = value >= 10 ? 'green' : value >= 8 ? 'amber' : 'red'
      }
      result.push({ slug, label, value, target, status, kind: 'stock' })
    } else {
      const target = conf.target
      const expected = getExpectedMonthly(target, nowDate)
      let status: FunnelStatus
      if (value >= expected) status = 'green'
      else if (value >= 0.75 * expected) status = 'amber'
      else status = 'red'
      result.push({ slug, label, value, target, status, kind: 'monthly' })
    }
  }
  return result
}

/** Prioridad para elegir UNA acción recomendada cuando hay rojos. */
const SUGGESTION_PRIORITY: readonly string[] = [
  'solicitudes_ingresadas',
  'citas_agendadas',
  'contactos_nuevos',
  'citas_cierre',
  'casos_ganados',
]

const SUGGESTION_MESSAGES: Record<string, string> = {
  solicitudes_ingresadas: 'Prioriza 1 solicitud hoy.',
  citas_agendadas: 'Convierte 2 contactos en citas.',
  contactos_nuevos: 'Agrega 3 nuevos contactos hoy.',
  citas_cierre: 'Agenda 1 cita de cierre.',
  casos_ganados: 'Cierra 1 caso esta semana.',
}

/**
 * Una sola recomendación: la de mayor prioridad entre las que están en rojo.
 */
export function pickPrimarySuggestion(
  statuses: FunnelMetricStatus[]
): { statusKey: string; message: string } | null {
  for (const key of SUGGESTION_PRIORITY) {
    const st = statuses.find((s) => s.slug === key && s.status === 'red')
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
