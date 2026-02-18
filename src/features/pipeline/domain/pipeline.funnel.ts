/**
 * Dominio: Mi Embudo — Inventario (stock) vs Producción del mes.
 * Inventario: cuántos leads están AHORA en cada etapa (por stage_id/slug).
 * Producción: cuántos eventos ocurrieron en el mes (por timestamps).
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
  /** Solo producción mensual: clave del estado de ritmo. */
  paceStatusKey?: PaceStatusKey
  /** Solo producción mensual: texto para UI (Requiere impulso / En progreso / En ritmo / Adelantado). */
  paceLabel?: string
  /** Solo producción mensual: tono para clase de color (red / amber / green / ahead). */
  paceTone?: PaceTone
}

export type PaceStatusKey = 'needs_push' | 'in_progress' | 'on_track' | 'ahead'
export type PaceTone = 'red' | 'amber' | 'green' | 'ahead'

export type PaceStatusResult = {
  statusKey: PaceStatusKey
  label: string
  tone: PaceTone
}

const PACE_LABELS: Record<PaceStatusKey, string> = {
  needs_push: 'Requiere impulso',
  in_progress: 'En progreso',
  on_track: 'En ritmo',
  ahead: 'Adelantado',
}

interface LeadLike {
  stage_id: string
}

/** Leads con timestamps para producción mensual. */
export interface LeadWithTimestamps {
  cita_realizada_at?: string | null
  propuesta_presentada_at?: string | null
  cerrado_at?: string | null
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

const PRODUCTION_SLUGS: readonly string[] = [
  'casos_abiertos',   // 1ª cita — cita_realizada_at
  'citas_cierre',     // Cierre — propuesta_presentada_at
  'casos_ganados',    // Póliza — cerrado_at
]

const SLUG_LABELS: Record<string, string> = {
  contactos_nuevos: 'Pendiente de cita',
  citas_agendadas: 'Cita agendada',
  solicitudes_ingresadas: 'En trámite',
  casos_abiertos: '1ª cita',
  citas_cierre: 'Cierre',
  casos_ganados: 'Póliza',
}

/** Metas: stock para inventario; mensual para producción. */
const META: Record<string, { target: number; kind: FunnelMetricKind }> = {
  contactos_nuevos: { target: 30, kind: 'stock' },
  citas_agendadas: { target: 10, kind: 'stock' },
  solicitudes_ingresadas: { target: 2, kind: 'stock' },
  casos_abiertos: { target: 8, kind: 'monthly' },
  citas_cierre: { target: 5, kind: 'monthly' },
  casos_ganados: { target: 4, kind: 'monthly' },
}

/**
 * Inventario: conteos por slug (cuántos están AHORA en esa etapa).
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
  for (const slug of [...INVENTORY_SLUGS, ...PRODUCTION_SLUGS]) {
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

/** Devuelve true si el ISO string cae en el mes (año y mes) de ref. */
function isInMonth(iso: string | null | undefined, ref: Date): boolean {
  if (!iso || typeof iso !== 'string') return false
  const d = new Date(iso)
  if (isNaN(d.getTime())) return false
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
}

/**
 * Producción del mes: conteos por eventos (timestamps en el mes actual).
 * - casos_abiertos: count(cita_realizada_at en el mes)
 * - citas_cierre: count(propuesta_presentada_at en el mes)
 * - casos_ganados: count(cerrado_at en el mes)
 */
export function getMonthlyProduction(
  leads: LeadWithTimestamps[],
  nowDate: Date = new Date()
): Record<string, number> {
  let primeraCita = 0
  let cierre = 0
  let poliza = 0
  for (const lead of leads) {
    if (isInMonth(lead.cita_realizada_at, nowDate)) primeraCita++
    if (isInMonth(lead.propuesta_presentada_at, nowDate)) cierre++
    if (isInMonth(lead.cerrado_at, nowDate)) poliza++
  }
  return {
    casos_abiertos: primeraCita,
    citas_cierre: cierre,
    casos_ganados: poliza,
  }
}

function getExpectedMonthly(meta: number, now: Date): number {
  const day = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const expected = meta * (day / daysInMonth)
  return expected < 1 ? 1 : expected
}

/** Expected para ritmo: día 1-2 sin mínimo (puede ser 0); desde día 3 mínimo 1. */
function getExpectedForPace(meta: number, now: Date): number {
  const day = now.getDate()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const raw = meta * (day / daysInMonth)
  if (day <= 2) return raw
  return raw < 1 ? 1 : raw
}

/**
 * Estado de ritmo para una métrica de producción mensual (solo frontend).
 * expected = meta * (day/daysInMonth); día 1-2 sin mínimo, desde día 3 mínimo 1.
 * Día 1-2 con actual 0 → En progreso para evitar falsos "Requiere impulso".
 */
export function computeMonthlyPaceStatus({
  actual,
  meta,
  nowDate,
}: {
  actual: number
  meta: number
  nowDate: Date
}): PaceStatusResult {
  const day = nowDate.getDate()
  const expected = getExpectedForPace(meta, nowDate)

  if (actual >= meta) {
    return { statusKey: 'ahead', label: PACE_LABELS.ahead, tone: 'ahead' }
  }
  if (day <= 2 && actual === 0) {
    return { statusKey: 'in_progress', label: PACE_LABELS.in_progress, tone: 'amber' }
  }
  if (day <= 2 && actual > 0) {
    return { statusKey: 'on_track', label: PACE_LABELS.on_track, tone: 'green' }
  }
  if (expected === 0) {
    return actual === 0
      ? { statusKey: 'in_progress', label: PACE_LABELS.in_progress, tone: 'amber' }
      : { statusKey: 'on_track', label: PACE_LABELS.on_track, tone: 'green' }
  }
  if (actual >= expected) {
    return { statusKey: 'on_track', label: PACE_LABELS.on_track, tone: 'green' }
  }
  if (actual >= 0.75 * expected) {
    return { statusKey: 'in_progress', label: PACE_LABELS.in_progress, tone: 'amber' }
  }
  return { statusKey: 'needs_push', label: PACE_LABELS.needs_push, tone: 'red' }
}

/**
 * Estado por métrica.
 * Inventario (stock): value = conteo por etapa actual.
 * Producción (monthly): value = conteo por timestamps en el mes.
 */
export function computeFunnelStatus(
  inventoryCounts: Record<string, number>,
  monthlyProduction: Record<string, number>,
  nowDate: Date = new Date()
): FunnelMetricStatus[] {
  const result: FunnelMetricStatus[] = []

  for (const slug of INVENTORY_SLUGS) {
    const conf = META[slug]
    if (!conf) continue
    const value = inventoryCounts[slug] ?? 0
    const label = SLUG_LABELS[slug] ?? slug
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
  }

  for (const slug of PRODUCTION_SLUGS) {
    const conf = META[slug]
    if (!conf) continue
    const value = monthlyProduction[slug] ?? 0
    const label = SLUG_LABELS[slug] ?? slug
    const target = conf.target
    const expected = getExpectedMonthly(target, nowDate)
    let status: FunnelStatus
    if (value >= expected) status = 'green'
    else if (value >= 0.75 * expected) status = 'amber'
    else status = 'red'
    const pace = computeMonthlyPaceStatus({ actual: value, meta: target, nowDate })
    result.push({
      slug,
      label,
      value,
      target,
      status,
      kind: 'monthly',
      paceStatusKey: pace.statusKey,
      paceLabel: pace.label,
      paceTone: pace.tone,
    })
  }

  return result
}

/** Prioridad para acción recomendada: SOLO inventario (stock). */
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
 * Solo considera métricas de INVENTARIO (stock), no producción mensual.
 */
export function pickPrimarySuggestion(
  statuses: FunnelMetricStatus[]
): { statusKey: string; message: string } | null {
  const stockStatuses = statuses.filter((s) => s.kind === 'stock')
  for (const key of SUGGESTION_PRIORITY) {
    const st = stockStatuses.find((s) => s.slug === key && s.status === 'red')
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
