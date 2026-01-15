/**
 * Helper para generar alertas del equipo
 * Derivado de weekStats y historyStats, sin tocar fórmulas base
 */

import type { AdvisorWeekStats, AdvisorHistoryStats } from '../../../pages/owner/utils/ownerDashboardHelpers'

export type AlertSeverity = 'info' | 'warn' | 'risk' | 'good'

export interface TeamAlert {
  key: string
  severity: AlertSeverity
  text: string
}

/**
 * Construir alertas del equipo
 */
export function buildTeamAlerts({
  weekStats,
  historyStats,
  weeklyTarget,
}: {
  weekStats: AdvisorWeekStats[]
  historyStats: AdvisorHistoryStats[]
  weeklyTarget: number
}): TeamAlert[] {
  const alerts: TeamAlert[] = []

  if (weekStats.length === 0) {
    return alerts
  }

  // 1) Asesores sin actividad esta semana
  const noActivity = weekStats.filter((s) => s.daysWithActivity === 0).length
  if (noActivity > 0) {
    alerts.push({
      key: 'no_activity',
      severity: 'risk',
      text: `${noActivity} ${noActivity === 1 ? 'asesor sin actividad' : 'asesores sin actividad'} esta semana`,
    })
  }

  // 2) Asesores con proyección < 80% de la meta
  const lowProjection = weekStats.filter((s) => {
    if (s.daysWithActivity === 0) return false // Ya contado en no_activity
    return s.projection < weeklyTarget * 0.8
  }).length
  if (lowProjection > 0) {
    alerts.push({
      key: 'low_projection',
      severity: 'warn',
      text: `${lowProjection} ${lowProjection === 1 ? 'asesor con proyección' : 'asesores con proyección'} < 80% de la meta`,
    })
  }

  // 3) Top 1 en excelente
  const excellent = weekStats.filter((s) => s.status === 'excellent')
  if (excellent.length > 0) {
    // Ordenar por puntos y tomar el primero
    const sorted = [...excellent].sort((a, b) => b.weekPoints - a.weekPoints)
    const top = sorted[0]
    const advisorName = top.advisor.full_name?.trim() || top.advisor.display_name?.trim() || 'Asesor'
    alerts.push({
      key: 'top_excellent',
      severity: 'good',
      text: `Top 1: ${advisorName} va en excelente`,
    })
  }

  // 4) Promedio del equipo
  const totalPoints = weekStats.reduce((sum, s) => sum + s.weekPoints, 0)
  const avgPoints = Math.round(totalPoints / weekStats.length)
  alerts.push({
    key: 'avg_points',
    severity: 'info',
    text: `Promedio del equipo: ${avgPoints} pts`,
  })

  // 5) Consistentes (12w avg >= weeklyTarget)
  const consistent = historyStats.filter((s) => s.averagePoints >= weeklyTarget).length
  if (consistent > 0) {
    alerts.push({
      key: 'consistent',
      severity: 'info',
      text: `Consistentes (12w avg >= meta): ${consistent}`,
    })
  }

  return alerts
}

/**
 * Obtener color y estilo para severity
 */
export function getAlertSeverityInfo(severity: AlertSeverity): {
  color: string
  bg: string
  icon: string
} {
  switch (severity) {
    case 'risk':
      return { color: 'text-red-600', bg: 'bg-red-50', icon: '⚠️' }
    case 'warn':
      return { color: 'text-amber-600', bg: 'bg-amber-50', icon: '⚠️' }
    case 'good':
      return { color: 'text-green-600', bg: 'bg-green-50', icon: '✅' }
    case 'info':
      return { color: 'text-blue-600', bg: 'bg-blue-50', icon: 'ℹ️' }
  }
}
