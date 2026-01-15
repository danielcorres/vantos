/**
 * Helpers para calcular insights de coaching para managers
 * Prioriza a quién coachar hoy basado en riesgo y puntos faltantes
 */

import type { AdvisorWeekStats, Advisor } from '../../../pages/owner/utils/ownerDashboardHelpers'
import { calculateAdvisorInsight } from './teamDashboardInsights'

export interface ManagerInsightSummary {
  teamPointsRemaining: number
  teamRequiredToday: number
  atRiskCount: number
  noActivityCount: number
  lowRhythmCount: number
  coachingQueue: Array<{
    advisorId: string
    name: string
    riskReason: 'no_activity' | 'low_rhythm' | 'on_track'
    pointsRemaining: number
    daysRemaining: number
    requiredDailyAvg: number
    weekPoints: number
    deltaVsPrev?: number | null
  }>
}

/**
 * Construir resumen de insights para manager
 * Calcula métricas del equipo y cola de coaching priorizada
 */
export function buildManagerInsightSummary({
  weekStats,
  weeklyTarget,
  weeklyDays,
  weekStartLocal,
  todayLocal,
  getAdvisorName,
  prevWeekPointsMap,
}: {
  weekStats: AdvisorWeekStats[]
  weeklyTarget: number
  weeklyDays: number
  weekStartLocal: string
  todayLocal: string
  getAdvisorName: (advisor: Advisor) => string
  prevWeekPointsMap?: Map<string, number> // Opcional: delta vs semana anterior
}): ManagerInsightSummary {
  // Si no hay stats, retornar vacío
  if (weekStats.length === 0) {
    return {
      teamPointsRemaining: 0,
      teamRequiredToday: 0,
      atRiskCount: 0,
      noActivityCount: 0,
      lowRhythmCount: 0,
      coachingQueue: [],
    }
  }

  // Calcular insights para cada asesor
  const insightsWithStats = weekStats.map((stat) => {
    const insight = calculateAdvisorInsight(stat, weeklyTarget, weeklyDays, weekStartLocal, todayLocal)
    return {
      stat,
      insight,
    }
  })

  // Filtrar solo asesores en riesgo (riskReason !== 'on_track')
  const atRiskInsights = insightsWithStats.filter((item) => item.insight.riskReason !== 'on_track')

  // Calcular métricas del equipo (solo asesores en riesgo)
  let teamPointsRemaining = 0
  let teamRequiredToday = 0

  atRiskInsights.forEach((item) => {
    teamPointsRemaining += item.insight.pointsRemaining
    teamRequiredToday += item.insight.requiredDailyAvg
  })

  // Contar por tipo de riesgo
  const noActivityCount = insightsWithStats.filter((item) => item.insight.riskReason === 'no_activity').length
  const lowRhythmCount = insightsWithStats.filter((item) => item.insight.riskReason === 'low_rhythm').length
  const atRiskCount = atRiskInsights.length

  // Construir cola de coaching (solo en riesgo, ordenada por prioridad)
  const coachingQueue = atRiskInsights
    .map((item) => {
      const advisor = item.stat.advisor
      const deltaVsPrev = prevWeekPointsMap?.get(advisor.user_id)
        ? item.stat.weekPoints - prevWeekPointsMap.get(advisor.user_id)!
        : null

      return {
        advisorId: advisor.user_id,
        name: getAdvisorName(advisor),
        riskReason: item.insight.riskReason,
        pointsRemaining: item.insight.pointsRemaining,
        daysRemaining: item.insight.daysRemaining,
        requiredDailyAvg: item.insight.requiredDailyAvg,
        weekPoints: item.stat.weekPoints,
        deltaVsPrev: deltaVsPrev !== null ? deltaVsPrev : undefined,
      }
    })
    .sort((a, b) => {
      // Ordenar: no_activity primero, luego requiredDailyAvg desc, luego pointsRemaining desc
      if (a.riskReason === 'no_activity' && b.riskReason !== 'no_activity') return -1
      if (a.riskReason !== 'no_activity' && b.riskReason === 'no_activity') return 1

      // Si ambos tienen el mismo riskReason, ordenar por requiredDailyAvg desc
      if (a.requiredDailyAvg !== b.requiredDailyAvg) {
        return b.requiredDailyAvg - a.requiredDailyAvg
      }

      // Si requiredDailyAvg es igual, ordenar por pointsRemaining desc
      return b.pointsRemaining - a.pointsRemaining
    })
    .slice(0, 5) // Limitar a top 5

  return {
    teamPointsRemaining: Math.round(teamPointsRemaining),
    teamRequiredToday: Math.round(teamRequiredToday),
    atRiskCount,
    noActivityCount,
    lowRhythmCount,
    coachingQueue,
  }
}
