/**
 * Helpers para calcular insights accionables del dashboard de equipo
 * Derivados de AdvisorWeekStats, sin tocar fórmulas base
 */

import type { AdvisorWeekStats } from '../../../pages/owner/utils/ownerDashboardHelpers'
import { businessDaysElapsedInWeek } from './businessDays'

export type RiskReason = 'no_activity' | 'low_rhythm' | 'on_track'

export interface AdvisorInsight {
  pointsRemaining: number
  daysRemaining: number
  requiredDailyAvg: number
  riskReason: RiskReason
}

/**
 * Calcular insights accionables para un asesor
 * Usa días hábiles reales del calendario, no daysWithActivity
 */
export function calculateAdvisorInsight(
  stat: AdvisorWeekStats,
  weeklyTarget: number,
  weeklyDays: number,
  weekStartLocal: string,
  todayLocal: string
): AdvisorInsight {
  const pointsRemaining = Math.max(weeklyTarget - stat.weekPoints, 0)
  
  // Calcular días hábiles transcurridos desde el inicio de la semana hasta hoy
  const daysElapsed = businessDaysElapsedInWeek({
    weekStartLocal,
    todayLocal,
    weeklyDays,
  })
  
  // Días restantes = días hábiles totales - días transcurridos
  const daysRemaining = Math.max(weeklyDays - daysElapsed, 0)
  
  let requiredDailyAvg = 0
  if (daysRemaining > 0) {
    requiredDailyAvg = Math.ceil(pointsRemaining / daysRemaining)
  } else if (pointsRemaining > 0) {
    requiredDailyAvg = pointsRemaining
  }

  // riskReason se mantiene igual (basado en daysWithActivity y projection, no en días calendario)
  let riskReason: RiskReason
  if (stat.daysWithActivity === 0) {
    riskReason = 'no_activity'
  } else if (stat.projection < weeklyTarget) {
    riskReason = 'low_rhythm'
  } else {
    riskReason = 'on_track'
  }

  return {
    pointsRemaining,
    daysRemaining,
    requiredDailyAvg,
    riskReason,
  }
}

/**
 * Obtener label y estilo para riskReason
 */
export function getRiskReasonInfo(reason: RiskReason): {
  label: string
  color: string
  bg: string
} {
  switch (reason) {
    case 'no_activity':
      return { label: 'Sin actividad', color: 'text-red-600', bg: 'bg-red-50' }
    case 'low_rhythm':
      return { label: 'Ritmo bajo', color: 'text-amber-600', bg: 'bg-amber-50' }
    case 'on_track':
      return { label: 'En camino', color: 'text-green-600', bg: 'bg-green-50' }
  }
}
