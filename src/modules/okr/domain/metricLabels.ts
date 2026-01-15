/**
 * Labels canónicos de métricas OKR
 * Única fuente de verdad para nombres de métricas en todo el sistema
 */

// Labels largos (default): textos completos para UI/tablas (Title Case)
const METRIC_LABELS_LONG: Record<string, string> = {
  calls: 'Llamadas',
  meetings_set: 'Citas agendadas',
  meetings_held: 'Citas realizadas',
  proposals_presented: 'Propuestas presentadas',
  applications_submitted: 'Solicitudes ingresadas',
  referrals: 'Referidos',
  policies_paid: 'Pólizas pagadas',
}

// Labels cortos: textos compactos para strings tipo "Hoy" o chips (pero consistentes)
const METRIC_LABELS_SHORT: Record<string, string> = {
  calls: 'Llamadas',
  meetings_set: 'Citas',
  meetings_held: 'Reuniones',
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
 * @returns Label legible (ej. 'Llamadas', 'Citas agendadas') o la clave si no existe
 */
export function getMetricLabel(metricKey: string, variant: 'long' | 'short' = 'long'): string {
  const labels = variant === 'short' ? METRIC_LABELS_SHORT : METRIC_LABELS_LONG
  return labels[metricKey] || metricKey
}
