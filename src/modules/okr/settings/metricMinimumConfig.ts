/**
 * Catálogo de métricas para configuración de mínimos semanales
 */

import { getMetricLabel } from '../domain/metricLabels'

export type MetricMinimumConfig = {
  key: string
  label: string
  tooltip: string
}

export const METRIC_MINIMUM_CONFIGS: MetricMinimumConfig[] = [
  {
    key: 'calls',
    label: getMetricLabel('calls', 'long'),
    tooltip: 'Llamadas en las que el prospecto contesta o hay interacción válida.',
  },
  {
    key: 'meetings_set',
    label: getMetricLabel('meetings_set', 'long'),
    tooltip: 'Citas iniciales acordadas con prospectos (primera reunión).',
  },
  {
    key: 'meetings_held',
    label: getMetricLabel('meetings_held', 'long'),
    tooltip: 'Citas iniciales efectivamente realizadas.',
  },
  {
    key: 'referrals',
    label: getMetricLabel('referrals', 'long'),
    tooltip: 'Referidos obtenidos con permiso para contactar.',
  },
  {
    key: 'proposals_presented',
    label: getMetricLabel('proposals_presented', 'long'),
    tooltip: 'Presentaciones de solución.',
  },
  {
    key: 'applications_submitted',
    label: getMetricLabel('applications_submitted', 'long'),
    tooltip: 'Solicitudes enviadas a la compañía.',
  },
  {
    key: 'policies_paid',
    label: getMetricLabel('policies_paid', 'long'),
    tooltip: 'Pólizas emitidas/pagadas.',
  },
  {
    key: 'written_premium_weekly_mxn',
    label: getMetricLabel('written_premium_weekly_mxn', 'long'),
    tooltip:
      'Meta semanal de prima emitida en pesos MXN (columna Pólizas Pagadas en pipeline / hub). Distinto del conteo de pólizas.',
  },
]
