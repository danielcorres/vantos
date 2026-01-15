/**
 * Helper para generar plan de acción del día para un asesor
 * Basado en requiredDailyAvg y distribución de métricas
 */

import type { RiskReason } from './teamDashboardInsights'
import { getMetricLabel } from '../domain/metricLabels'

export interface TodayPlanItem {
  metric_key: string
  units: number
  pointsPerUnit: number
}

export interface TodayPlan {
  label: string
  items: TodayPlanItem[]
  isKickstart: boolean
  requiredDailyAvgPoints: number
  distribution: {
    calls: number
    meetings_set: number
    proposals_presented: number
  }
  skippedMetrics: string[]
}

// Métricas default para sugerencias (hardcode por ahora)
const DEFAULT_METRICS = ['calls', 'meetings_set', 'proposals_presented'] as const

// Distribución de puntos: 60% calls, 30% meetings_set, 10% proposals_presented
const DISTRIBUTION = {
  calls: 0.6,
  meetings_set: 0.3,
  proposals_presented: 0.1,
} as const

/**
 * Construir plan del día para un asesor
 */
export function buildTodayPlanForAdvisor({
  requiredDailyAvg,
  riskReason,
  scoresMap,
}: {
  requiredDailyAvg: number
  riskReason: RiskReason
  scoresMap: Map<string, number>
}): TodayPlan {
  const requiredDailyAvgPoints = requiredDailyAvg
  const isKickstart = riskReason === 'no_activity'

  // Si no requiere puntos, retornar plan vacío con "Mantener"
  if (requiredDailyAvgPoints <= 0) {
    return {
      label: '✅',
      items: [],
      isKickstart: false,
      requiredDailyAvgPoints: 0,
      distribution: { calls: 0, meetings_set: 0, proposals_presented: 0 },
      skippedMetrics: [],
    }
  }

  // Si es kickstart (sin actividad), forzar mínimo de arranque
  if (isKickstart) {
    // Buscar la métrica más fácil disponible (mayor points_per_unit, o preferir calls si existe)
    let bestMetric: string | null = null
    let bestPointsPerUnit = 0

    // Preferir calls si existe
    if (scoresMap.has('calls')) {
      const pointsPerUnit = scoresMap.get('calls') || 0
      if (pointsPerUnit > 0) {
        bestMetric = 'calls'
        bestPointsPerUnit = pointsPerUnit
      }
    }

    // Si no hay calls, buscar la de mayor points_per_unit
    if (!bestMetric) {
      for (const metric of DEFAULT_METRICS) {
        if (scoresMap.has(metric)) {
          const pointsPerUnit = scoresMap.get(metric) || 0
          if (pointsPerUnit > 0 && pointsPerUnit > bestPointsPerUnit) {
            bestMetric = metric
            bestPointsPerUnit = pointsPerUnit
          }
        }
      }
    }

    if (bestMetric && bestPointsPerUnit > 0) {
      return {
        label: `1 ${getMetricLabel(bestMetric)} (Arranque)`,
        items: [
          {
            metric_key: bestMetric,
            units: 1,
            pointsPerUnit: bestPointsPerUnit,
          },
        ],
        isKickstart: true,
        requiredDailyAvgPoints: requiredDailyAvgPoints,
        distribution: {
          calls: bestMetric === 'calls' ? 1 : 0,
          meetings_set: bestMetric === 'meetings_set' ? 1 : 0,
          proposals_presented: bestMetric === 'proposals_presented' ? 1 : 0,
        },
        skippedMetrics: DEFAULT_METRICS.filter((m) => m !== bestMetric),
      }
    }

    // Si no hay métricas disponibles, retornar plan vacío
    return {
      label: 'Sin métricas configuradas',
      items: [],
      isKickstart: true,
      requiredDailyAvgPoints: requiredDailyAvgPoints,
      distribution: { calls: 0, meetings_set: 0, proposals_presented: 0 },
      skippedMetrics: [...DEFAULT_METRICS],
    }
  }

  // Plan normal: distribuir puntos según porcentajes
  const items: TodayPlanItem[] = []
  const skippedMetrics: string[] = []
  const distribution: { calls: number; meetings_set: number; proposals_presented: number } = {
    calls: 0,
    meetings_set: 0,
    proposals_presented: 0,
  }

  // Filtrar métricas disponibles (que existen en scoresMap y tienen points_per_unit > 0)
  const availableMetrics = DEFAULT_METRICS.filter((metric) => {
    const pointsPerUnit = scoresMap.get(metric) || 0
    return pointsPerUnit > 0
  })

  if (availableMetrics.length === 0) {
    return {
      label: 'Sin métricas configuradas',
      items: [],
      isKickstart: false,
      requiredDailyAvgPoints: requiredDailyAvgPoints,
      distribution: { calls: 0, meetings_set: 0, proposals_presented: 0 },
      skippedMetrics: [...DEFAULT_METRICS],
    }
  }

  // Calcular puntos por métrica según distribución
  const pointsByMetric: Record<string, number> = {}
  let totalDistribution = 0

  for (const metric of availableMetrics) {
    const ratio = DISTRIBUTION[metric as keyof typeof DISTRIBUTION] || 0
    totalDistribution += ratio
  }

  // Si no hay distribución válida, distribuir equitativamente
  if (totalDistribution === 0) {
    const equalRatio = 1 / availableMetrics.length
    for (const metric of availableMetrics) {
      pointsByMetric[metric] = requiredDailyAvgPoints * equalRatio
    }
  } else {
    // Distribuir según ratios, normalizando si alguna métrica no está disponible
    for (const metric of availableMetrics) {
      const ratio = DISTRIBUTION[metric as keyof typeof DISTRIBUTION] || 0
      pointsByMetric[metric] = requiredDailyAvgPoints * (ratio / totalDistribution)
    }
  }

  // Convertir puntos a unidades (redondear hacia arriba)
  for (const metric of availableMetrics) {
    const points = pointsByMetric[metric]
    const pointsPerUnit = scoresMap.get(metric) || 0

    if (pointsPerUnit > 0 && points > 0) {
      const units = Math.ceil(points / pointsPerUnit)
      if (units > 0) {
        items.push({
          metric_key: metric,
          units,
          pointsPerUnit,
        })

        // Actualizar distribución
        if (metric === 'calls') distribution.calls = units
        else if (metric === 'meetings_set') distribution.meetings_set = units
        else if (metric === 'proposals_presented') distribution.proposals_presented = units
      }
    }
  }

  // Métricas omitidas
  for (const metric of DEFAULT_METRICS) {
    if (!availableMetrics.includes(metric)) {
      skippedMetrics.push(metric)
    }
  }

  // Generar label compacto
  const labelParts = items.map((item) => `${item.units} ${getMetricLabel(item.metric_key)}`)
  const label = labelParts.length > 0 ? labelParts.join(' · ') : 'Sin plan'

  return {
    label,
    items,
    isKickstart: false,
    requiredDailyAvgPoints: requiredDailyAvgPoints,
    distribution,
    skippedMetrics,
  }
}
