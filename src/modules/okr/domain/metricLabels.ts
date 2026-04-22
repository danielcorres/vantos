/**
 * Labels canónicos de métricas OKR
 * Única fuente de verdad para nombres de métricas en todo el sistema
 */

/** Orden de visualización en UI (sin tocar sort_order en BD). Referidos tras citas iniciales realizadas. */
export const OKR_CORE_METRIC_DISPLAY_ORDER = [
  'calls',
  'meetings_set',
  'meetings_held',
  'referrals',
  'proposals_presented',
  'applications_submitted',
  'policies_paid',
] as const

const DISPLAY_ORDER_INDEX = new Map<string, number>(
  OKR_CORE_METRIC_DISPLAY_ORDER.map((key, index) => [key, index])
)

/**
 * Comparar dos metric_key para ordenar listas OKR.
 * Claves fuera del catálogo core van al final; desempate alfabético.
 */
export function compareOkrMetricDisplayOrder(aKey: string, bKey: string): number {
  const ia = DISPLAY_ORDER_INDEX.has(aKey) ? DISPLAY_ORDER_INDEX.get(aKey)! : 1000
  const ib = DISPLAY_ORDER_INDEX.has(bKey) ? DISPLAY_ORDER_INDEX.get(bKey)! : 1000
  if (ia !== ib) return ia - ib
  return aKey.localeCompare(bKey)
}

// Labels largos (default): textos completos para UI/tablas (Title Case)
// contacts_made / meetings_done: claves legacy en activity_events (métricas desactivadas en BD)
const METRIC_LABELS_LONG: Record<string, string> = {
  calls: 'Llamadas Contestadas',
  contacts_made: 'Llamadas Contestadas',
  meetings_set: 'Citas Iniciales Agendadas',
  meetings_held: 'Citas Iniciales Realizadas',
  meetings_done: 'Citas Iniciales Realizadas',
  proposals_presented: 'Propuestas presentadas',
  applications_submitted: 'Solicitudes ingresadas',
  referrals: 'Referidos',
  policies_paid: 'Pólizas pagadas',
}

// Labels cortos: textos compactos para strings tipo "Hoy" o chips (pero consistentes)
const METRIC_LABELS_SHORT: Record<string, string> = {
  calls: 'Llamadas contest.',
  contacts_made: 'Llamadas contest.',
  meetings_set: 'Citas inic. agend.',
  meetings_held: 'Citas inic. real.',
  meetings_done: 'Citas inic. real.',
  proposals_presented: 'Propuestas',
  applications_submitted: 'Solicitudes',
  referrals: 'Referidos',
  policies_paid: 'Pólizas',
}

// Mantener compatibilidad: exportar METRIC_LABELS como alias de LONG
export const METRIC_LABELS: Record<string, string> = METRIC_LABELS_LONG

/**
 * Obtener label canónico de una métrica
 * @param metricKey Clave de la métrica (ej. 'calls', 'meetings_set')
 * @param variant Variante del label: 'long' (default) o 'short'
 * @returns Label legible o la clave si no existe
 */
export function getMetricLabel(metricKey: string, variant: 'long' | 'short' = 'long'): string {
  const labels = variant === 'short' ? METRIC_LABELS_SHORT : METRIC_LABELS_LONG
  return labels[metricKey] || metricKey
}
