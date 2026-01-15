/**
 * Tabla compartida para consistencia histórica de 12 semanas
 */

import { useMemo } from 'react'
import type { AdvisorHistoryStats } from '../../../pages/owner/utils/ownerDashboardHelpers'
import type { Advisor } from '../../../pages/owner/utils/ownerDashboardHelpers'

export interface TeamConsistencyTableProps {
  historyStats: AdvisorHistoryStats[]
  weeklyTarget: number
  getAdvisorName: (advisor: Advisor) => string
}

export function TeamConsistencyTable({
  historyStats,
  weeklyTarget,
  getAdvisorName,
}: TeamConsistencyTableProps) {
  // Ordenar por promedio desc
  const sortedStats = useMemo(() => {
    return [...historyStats].sort((a, b) => b.averagePoints - a.averagePoints)
  }, [historyStats])

  return (
    <div className="card p-0 overflow-hidden">
      <div className="p-3 border-b border-border">
        <h2 className="text-sm font-medium text-muted">Consistencia 12 semanas</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg border-b border-border">
            <tr>
              <th className="text-left py-2 px-4 text-xs font-medium text-muted uppercase">Asesor</th>
              <th className="text-right py-2 px-4 text-xs font-medium text-muted uppercase">Cumplidas</th>
              <th className="text-right py-2 px-4 text-xs font-medium text-muted uppercase">Promedio</th>
              <th className="text-right py-2 px-4 text-xs font-medium text-muted uppercase">Mejor</th>
            </tr>
          </thead>
          <tbody>
            {sortedStats.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-center py-12 px-4 text-muted">
                  No hay datos históricos
                </td>
              </tr>
            ) : (
              sortedStats.map((stat, index) => {
                const isConsistent = stat.averagePoints >= weeklyTarget
                return (
                  <tr key={stat.advisor.user_id} className={`border-b border-border hover:bg-primary/5 transition-colors ${index % 2 === 0 ? 'bg-bg' : 'bg-surface'}`}>
                    <td className="py-2 px-4 font-medium text-left">{getAdvisorName(stat.advisor)}</td>
                    <td className="py-2 px-4 text-right">
                      <span className="font-semibold">{stat.weeksCompleted}</span>
                      <span className="text-muted"> / 12</span>
                    </td>
                    <td className="py-2 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="font-medium">{stat.averagePoints} pts</span>
                        {isConsistent && (
                          <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-green-50 text-green-700">
                            Consistente
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-4 text-right font-medium">{stat.bestWeek} pts</td>
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
