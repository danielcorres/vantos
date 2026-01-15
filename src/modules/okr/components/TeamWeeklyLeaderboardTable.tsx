/**
 * Tabla compartida para leaderboard semanal de equipo
 * Vista de desempeño comparativo del equipo
 */

import { useState, useMemo } from 'react'
import type { AdvisorWeekStats } from '../../../pages/owner/utils/ownerDashboardHelpers'
import type { Advisor } from '../../../pages/owner/utils/ownerDashboardHelpers'
import { calculateAdvisorInsight } from '../dashboard/teamDashboardInsights'
import { getMetricLabel } from '../domain/metricLabels'
import { buildMetricBreakdown } from '../dashboard/advisorDetailHelpers'
import type { WeeklyMinimumTargetsMap } from '../dashboard/weeklyMinimumTargets'

export interface TeamWeeklyLeaderboardTableProps {
  weekStats: AdvisorWeekStats[]
  weeklyTarget: number
  weeklyDays: number
  weekStartLocal: string
  weekEndLocal: string
  todayLocal: string
  scoresMap: Map<string, number>
  eventsWeek: Array<{ recorded_at: string; metric_key: string; value: number | null; actor_user_id: string }>
  onAdvisorClick?: (advisorId: string) => void
  defaultSort?: 'points' | 'status'
  getAdvisorName: (advisor: Advisor) => string
  weeklyMinimums?: WeeklyMinimumTargetsMap
}

// Orden de métricas para columnas (orden operativo natural)
const METRIC_ORDER = [
  'calls',
  'meetings_set',
  'meetings_held',
  'proposals_presented',
  'applications_submitted',
  'referrals',
  'policies_paid',
] as const

export function TeamWeeklyLeaderboardTable({
  weekStats,
  weeklyTarget,
  weeklyDays,
  weekStartLocal,
  weekEndLocal,
  todayLocal,
  scoresMap,
  eventsWeek,
  onAdvisorClick,
  defaultSort = 'points',
  getAdvisorName,
  weeklyMinimums,
}: TeamWeeklyLeaderboardTableProps) {
  const [sortField, setSortField] = useState<'points' | 'status'>(defaultSort)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Calcular métricas por asesor y estado
  const statsWithMetrics = useMemo(() => {
    return weekStats.map((stat) => {
      // Filtrar eventos del asesor
      const advisorEvents = eventsWeek.filter(
        (e) => e.actor_user_id === stat.advisor.user_id && e.value !== null
      )

      // Calcular breakdown de métricas
      const breakdown = buildMetricBreakdown(
        advisorEvents.map((e) => ({ metric_key: e.metric_key, value: e.value || 0 })),
        scoresMap
      )

      // Crear mapa de unidades por métrica
      const metricUnitsMap = new Map<string, number>()
      breakdown.forEach((row) => {
        metricUnitsMap.set(row.metric_key, row.units)
      })

      // Calcular insight para estado
      const insight = calculateAdvisorInsight(stat, weeklyTarget, weeklyDays, weekStartLocal, todayLocal)

      // Determinar estado simplificado
      let statusLabel: 'En camino' | 'Ritmo bajo' | 'En riesgo'
      let statusColor: string
      let statusBg: string
      let statusTooltip: string

      if (insight.riskReason === 'on_track') {
        statusLabel = 'En camino'
        statusColor = 'text-green-700'
        statusBg = 'bg-green-50'
        statusTooltip = 'El asesor está cumpliendo con la meta semanal.'
      } else if (insight.riskReason === 'low_rhythm') {
        statusLabel = 'Ritmo bajo'
        statusColor = 'text-amber-700'
        statusBg = 'bg-amber-50'
        statusTooltip = 'El asesor tiene actividad pero necesita acelerar para cumplir la meta.'
      } else {
        statusLabel = 'En riesgo'
        statusColor = 'text-red-700'
        statusBg = 'bg-red-50'
        statusTooltip = 'El asesor no tiene actividad o está muy por debajo de la meta.'
      }

      return {
        stat,
        metricUnitsMap,
        statusLabel,
        statusColor,
        statusBg,
        statusTooltip,
      }
    })
  }, [weekStats, eventsWeek, scoresMap, weeklyTarget, weeklyDays, weekStartLocal, todayLocal])

  // Ordenar
  const sortedStats = useMemo(() => {
    const sorted = [...statsWithMetrics].sort((a, b) => {
      if (sortField === 'points') {
        return sortDirection === 'asc'
          ? a.stat.weekPoints - b.stat.weekPoints
          : b.stat.weekPoints - a.stat.weekPoints
      } else {
        // status: En riesgo < Ritmo bajo < En camino
        const statusOrder: Record<string, number> = {
          'En riesgo': 0,
          'Ritmo bajo': 1,
          'En camino': 2,
        }
        const aOrder = statusOrder[a.statusLabel] || 0
        const bOrder = statusOrder[b.statusLabel] || 0
        return sortDirection === 'asc' ? aOrder - bOrder : bOrder - aOrder
      }
    })
    return sorted
  }, [statsWithMetrics, sortField, sortDirection])

  const handleSort = (field: 'points' | 'status') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const SortIcon = ({ field }: { field: 'points' | 'status' }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? '↑' : '↓'
  }

  const handleRowClick = (advisorId: string) => {
    if (onAdvisorClick) {
      onAdvisorClick(advisorId)
    }
  }

  // Helper para dividir label en 2 líneas si es largo
  const splitLabel = (label: string): [string, string] => {
    const words = label.split(' ')
    if (words.length <= 2) return [label, '']
    const mid = Math.ceil(words.length / 2)
    return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')]
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Leaderboard Semanal</h2>
          <div className="group relative">
            <div className="w-4 h-4 flex items-center justify-center bg-black/5 rounded-full cursor-help">
              <span className="text-[10px] text-muted">ⓘ</span>
            </div>
            <div className="absolute left-0 top-full mt-1 w-64 p-2 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none z-20 shadow-lg">
              Métricas reales de la semana. Da click en un asesor para ver detalle y plan.
              <div className="absolute left-4 top-0 -translate-y-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-black"></div>
            </div>
          </div>
          <p className="text-xs text-muted ml-auto">Semana: {weekStartLocal} - {weekEndLocal}</p>
        </div>
      </div>
      <div className="overflow-x-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#e0e0e0 transparent' }}>
        <style>{`
          div::-webkit-scrollbar {
            height: 6px;
          }
          div::-webkit-scrollbar-track {
            background: transparent;
          }
          div::-webkit-scrollbar-thumb {
            background-color: #e0e0e0;
            border-radius: 3px;
          }
          div:hover::-webkit-scrollbar-thumb {
            background-color: rgba(0, 0, 0, 0.2);
          }
        `}</style>
        <table className="w-full text-sm">
          <thead className="bg-bg border-b-2 border-border">
            <tr>
              <th
                className="sticky left-0 z-10 bg-bg text-left py-1.5 px-4 text-xs font-semibold text-muted uppercase cursor-pointer hover:bg-black/5 min-w-[120px] border-r border-border"
                onClick={() => handleSort('points')}
              >
                Asesor <SortIcon field="points" />
              </th>
              <th
                className="text-right py-1.5 px-4 text-xs font-semibold text-muted uppercase cursor-pointer hover:bg-black/5 min-w-[70px]"
                onClick={() => handleSort('points')}
              >
                Puntos <SortIcon field="points" />
              </th>
              <th className="text-right py-1.5 px-4 text-xs font-semibold text-muted uppercase min-w-[70px]">% de meta</th>
              {METRIC_ORDER.map((metricKey) => {
                const label = getMetricLabel(metricKey, 'long')
                const [line1, line2] = splitLabel(label)
                return (
                  <th key={metricKey} className="text-right py-1.5 px-3 text-xs font-semibold text-muted uppercase min-w-[80px]">
                    <div className="leading-tight">
                      <div>{line1}</div>
                      {line2 && <div className="text-[10px]">{line2}</div>}
                    </div>
                  </th>
                )
              })}
              <th
                className="text-center py-1.5 px-4 text-xs font-semibold text-muted uppercase cursor-pointer hover:bg-black/5 min-w-[100px] group relative"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center justify-center gap-1">
                  Estado <SortIcon field="status" />
                  <div className="w-3 h-3 flex items-center justify-center bg-black/5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-help">
                    <span className="text-[8px] text-muted">ⓘ</span>
                  </div>
                </div>
                <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-64 p-2 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none z-20 shadow-lg">
                  En camino = ritmo suficiente. Ritmo bajo = requiere empuje. Crítico/En riesgo = necesita atención.
                  <div className="absolute left-1/2 -translate-x-1/2 top-0 -translate-y-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-black"></div>
                </div>
              </th>
              {onAdvisorClick && (
                <th className="w-[30px] py-1.5 px-3"></th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedStats.length === 0 ? (
              <tr>
                <td colSpan={3 + METRIC_ORDER.length + 1 + (onAdvisorClick ? 1 : 0)} className="text-center py-8 px-4 text-muted bg-surface">
                  No hay asesores registrados
                </td>
              </tr>
            ) : (
              sortedStats.map(({ stat, metricUnitsMap, statusLabel, statusColor, statusBg, statusTooltip }, index) => {
                const isClickable = !!onAdvisorClick

                return (
                  <tr
                    key={stat.advisor.user_id}
                    role={isClickable ? 'button' : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault()
                        handleRowClick(stat.advisor.user_id)
                      }
                    }}
                    className={`border-b border-border hover:bg-primary/5 transition-colors ${
                      index % 2 === 0 ? 'bg-bg' : 'bg-surface'
                    } ${isClickable ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50' : ''}`}
                    onClick={() => isClickable && handleRowClick(stat.advisor.user_id)}
                  >
                    <td className={`sticky left-0 z-10 py-1.5 px-4 font-medium text-left min-w-[120px] border-r border-border ${
                      index % 2 === 0 ? 'bg-bg' : 'bg-surface'
                    }`}>
                      {getAdvisorName(stat.advisor)}
                    </td>
                    <td className="py-1.5 px-4 text-right min-w-[70px]">
                      <span className="font-bold text-base">{Math.round(stat.weekPoints)}</span>
                    </td>
                    <td className="py-1.5 px-4 text-right text-muted text-xs min-w-[70px]">{Math.round(stat.percentOfTarget)}%</td>
                    {METRIC_ORDER.map((metricKey) => {
                      const units = metricUnitsMap.get(metricKey) || 0
                      const minimum = weeklyMinimums?.[metricKey]
                      const isBelowMinimum = minimum !== undefined && units < minimum
                      return (
                        <td key={metricKey} className="py-1.5 px-3 text-right text-muted font-mono text-xs min-w-[80px]">
                          <div className="flex flex-col items-end">
                            <span className={isBelowMinimum ? 'font-medium' : ''}>
                              {units > 0 ? units : '—'}
                            </span>
                            {minimum !== undefined && (
                              <span className={`text-[10px] ${isBelowMinimum ? 'text-amber-600' : 'text-muted'}`}>
                                {units > 0 ? `${units} / ${minimum}` : `— / ${minimum}`}
                              </span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                    <td className="py-1.5 px-4 text-center min-w-[100px]">
                      <div className="group relative inline-block">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusBg} ${statusColor}`}>
                          {statusLabel}
                        </span>
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none z-20 shadow-lg">
                          {statusTooltip}
                          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
                        </div>
                      </div>
                    </td>
                    {isClickable && (
                      <td className="py-1.5 px-3 text-muted text-lg min-w-[30px]">
                        <span className="opacity-40">›</span>
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
