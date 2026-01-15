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
    tooltip: 'Contactos gestionados por teléfono.',
  },
  {
    key: 'meetings_set',
    label: getMetricLabel('meetings_set', 'long'),
    tooltip: 'Citas acordadas con prospectos.',
  },
  {
    key: 'meetings_held',
    label: getMetricLabel('meetings_held', 'long'),
    tooltip: 'Citas efectivamente realizadas.',
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
    key: 'referrals',
    label: getMetricLabel('referrals', 'long'),
    tooltip: 'Referidos obtenidos con permiso para contactar.',
  },
  {
    key: 'policies_paid',
    label: getMetricLabel('policies_paid', 'long'),
    tooltip: 'Pólizas emitidas/pagadas.',
  },
]
