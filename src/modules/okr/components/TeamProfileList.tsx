/**
 * Lista de asesores con sus perfiles para el bloque "Perfil del equipo"
 */

import { useState, useMemo } from 'react'
import type { Advisor } from '../../../pages/owner/utils/ownerDashboardHelpers'
import type { AdvisorProfileResult } from '../dashboard/advisorProfile'
import { getMetricLabel } from '../domain/metricLabels'
import type { WeeklyMinimumTargetsMap } from '../dashboard/weeklyMinimumTargets'

export interface AdvisorProfileItem {
  advisor: Advisor
  profile: AdvisorProfileResult
  metrics: Record<string, number>
  weekPoints: number
  percentOfTarget: number
}

export interface TeamProfileListProps {
  advisorProfiles: AdvisorProfileItem[]
  getAdvisorName: (advisor: Advisor) => string
  onAdvisorClick?: (advisorId: string) => void
  weeklyMinimums: WeeklyMinimumTargetsMap
}

export function TeamProfileList({
  advisorProfiles,
  getAdvisorName,
  onAdvisorClick,
  weeklyMinimums,
}: TeamProfileListProps) {
  const [showOnlyRisk, setShowOnlyRisk] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Filtrar asesores
  const filteredProfiles = useMemo(() => {
    let filtered = advisorProfiles

    // Filtro de riesgo
    if (showOnlyRisk) {
      filtered = filtered.filter(
        (item) => item.profile.key === 'inactive' || item.profile.key === 'intermittent'
      )
    }

    // Filtro de búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter((item) => {
        const name = getAdvisorName(item.advisor).toLowerCase()
        return name.includes(query)
      })
    }

    return filtered
  }, [advisorProfiles, showOnlyRisk, searchQuery, getAdvisorName])

  // Calcular métricas cumplidas
  const getMetricsCompliance = (metrics: Record<string, number>) => {
    const metricsWithMin = Object.entries(weeklyMinimums).filter(([_, min]) => min > 0)
    const metricsMet = metricsWithMin.filter(([key, min]) => (metrics[key] || 0) >= min).length
    return { met: metricsMet, total: metricsWithMin.length }
  }

  // Obtener color y estilo del badge según perfil
  const getProfileBadgeStyle = (profile: AdvisorProfileResult) => {
    switch (profile.tone) {
      case 'success':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'info':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'warning':
        return 'bg-amber-50 text-amber-700 border-amber-200'
      case 'danger':
        return 'bg-red-50 text-red-700 border-red-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  return (
    <div className="space-y-3">
      {/* Filtros rápidos */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-border rounded-md bg-surface text-text focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
        <label className="flex items-center gap-2 text-xs cursor-pointer hover:text-text transition-colors">
          <input
            type="checkbox"
            checked={showOnlyRisk}
            onChange={(e) => setShowOnlyRisk(e.target.checked)}
            className="rounded cursor-pointer"
          />
          <span className="text-muted font-medium">Ver solo riesgo</span>
        </label>
      </div>

      {/* Tabla de asesores */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg border-b-2 border-border">
            <tr>
              <th className="text-left py-2 px-4 text-xs font-semibold text-muted uppercase">Asesor</th>
              <th className="text-center py-2 px-4 text-xs font-semibold text-muted uppercase">Perfil</th>
              <th className="text-right py-2 px-4 text-xs font-semibold text-muted uppercase">Cumplimiento</th>
              <th className="text-left py-2 px-4 text-xs font-semibold text-muted uppercase">Faltan</th>
              <th className="text-center py-2 px-4 text-xs font-semibold text-muted uppercase w-12">Ayuda</th>
            </tr>
          </thead>
          <tbody>
            {filteredProfiles.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 px-4 text-muted bg-surface">
                  {showOnlyRisk || searchQuery ? 'No hay asesores que coincidan con los filtros' : 'No hay asesores'}
                </td>
              </tr>
            ) : (
              filteredProfiles.map((item, index) => {
                const { met, total } = getMetricsCompliance(item.metrics)
                const isClickable = !!onAdvisorClick

                return (
                  <tr
                    key={item.advisor.user_id}
                    role={isClickable ? 'button' : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault()
                        onAdvisorClick(item.advisor.user_id)
                      }
                    }}
                    className={`border-b border-border hover:bg-primary/5 transition-colors ${
                      index % 2 === 0 ? 'bg-bg' : 'bg-surface'
                    } ${isClickable ? 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50' : ''}`}
                    onClick={() => isClickable && onAdvisorClick(item.advisor.user_id)}
                  >
                    <td className="py-2 px-4 font-medium text-left">{getAdvisorName(item.advisor)}</td>
                    <td className="py-2 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${getProfileBadgeStyle(
                          item.profile
                        )}`}
                      >
                        {item.profile.label}
                      </span>
                    </td>
                    <td className="py-2 px-4 text-right text-xs text-muted">
                      Cumple {met}/{total} mínimos
                    </td>
                    <td className="py-2 px-4 text-left">
                      {item.profile.missing.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {item.profile.missing.slice(0, 2).map((missing) => {
                            const diff = missing.min - missing.current
                            return (
                              <span
                                key={missing.metricKey}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200"
                              >
                                {getMetricLabel(missing.metricKey, 'long')}: -{diff}
                              </span>
                            )
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className="py-2 px-4 text-center">
                      <div className="group relative inline-block">
                        <div className="w-5 h-5 flex items-center justify-center bg-black/5 rounded-full cursor-help">
                          <span className="text-[10px] text-muted">ⓘ</span>
                        </div>
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-56 p-2 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none z-20 shadow-lg whitespace-pre-line">
                          {item.profile.shortHelp}
                          {item.profile.reasons.length > 0 && (
                            <>
                              {'\n\n'}
                              {item.profile.reasons.map((reason, i) => (
                                <span key={i}>
                                  • {reason}
                                  {i < item.profile.reasons.length - 1 && '\n'}
                                </span>
                              ))}
                            </>
                          )}
                          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
                        </div>
                      </div>
                    </td>
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
