import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useUserRole } from '../../shared/hooks/useUserRole'
import { useAuth } from '../../shared/auth/AuthProvider'
import { useTeamOkrDashboard } from '../../modules/okr/dashboard/useTeamOkrDashboard'
import { useDashboardSnapshot } from '../../modules/okr/dashboard/useDashboardSnapshot'
import { TeamWeeklyLeaderboardTable } from '../../modules/okr/components/TeamWeeklyLeaderboardTable'
import { buildTeamAlerts, getAlertSeverityInfo } from '../../modules/okr/dashboard/teamAlerts'
import { TeamProfileList } from '../../modules/okr/components/TeamProfileList'
import {
  type Advisor,
} from '../owner/utils/ownerDashboardHelpers'
import { getMetricLabel } from '../../modules/okr/domain/metricLabels'
import { fetchWeeklyMinimumTargetsForOwner, DEFAULT_WEEKLY_MINIMUMS, type WeeklyMinimumTargetsMap } from '../../modules/okr/dashboard/weeklyMinimumTargets'
import { supabase } from '../../lib/supabaseClient'
import { buildAdvisorProfile, type AdvisorProfileResult } from '../../modules/okr/dashboard/advisorProfile'
import { buildMetricBreakdown } from '../../modules/okr/dashboard/advisorDetailHelpers'
import { addDaysYmd } from '../../shared/utils/dates'
import { calcWeekRangeLocal, formatWeekRangePretty } from '../../modules/okr/utils/weeklyHistoryHelpers'

const IS_DEV = import.meta.env.DEV

export function ManagerDashboardPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, systemOwnerId } = useAuth()
  const { role, loading: roleLoading } = useUserRole()
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const isManager = role === 'manager' || role === 'owner'

  // Leer semana desde query param, o usar semana actual por defecto
  const currentWeekRange = calcWeekRangeLocal()
  const weekStartFromUrl = searchParams.get('weekStart')
  const selectedWeekStart = weekStartFromUrl || currentWeekRange.weekStartLocal

  // Validar que la semana seleccionada no sea futura
  const isValidWeek = selectedWeekStart <= currentWeekRange.weekStartLocal
  const weekStartLocalToUse = isValidWeek ? selectedWeekStart : currentWeekRange.weekStartLocal

  // Corregir URL si se intenta acceder a una semana futura
  useEffect(() => {
    if (weekStartFromUrl && !isValidWeek) {
      setSearchParams({}, { replace: true })
    }
  }, [weekStartFromUrl, isValidWeek, setSearchParams])

  // Usar hook compartido para datos del dashboard
  const {
    weekStats,
    historyStats,
    dailyTarget,
    weeklyDays,
    weeklyTarget,
    weekStartLocal,
    weekEndLocal,
    todayLocal,
    advisorIds,
    scoresMap,
    eventsWeek,
    loading,
    error,
    reload: loadData,
  } = useTeamOkrDashboard({
    mode: 'manager',
    managerUserId: user?.id,
    weekStartLocal: weekStartLocalToUse,
  })

  const { copySnapshot } = useDashboardSnapshot()

  // Estados para mínimos semanales
  const [weeklyMinimums, setWeeklyMinimums] = useState<WeeklyMinimumTargetsMap>(DEFAULT_WEEKLY_MINIMUMS)
  const [weeklyMinimumsSource, setWeeklyMinimumsSource] = useState<'db' | 'default'>('default')

  // Cargar mínimos semanales
  useEffect(() => {
    if (!systemOwnerId || loading) return

    const loadMinimums = async () => {
      try {
        const { targets, source } = await fetchWeeklyMinimumTargetsForOwner(supabase, systemOwnerId)
        setWeeklyMinimums(targets)
        setWeeklyMinimumsSource(source)
      } catch (err) {
        console.error('[ManagerDashboardPage] Error loading weekly minimums:', err)
        setWeeklyMinimums(DEFAULT_WEEKLY_MINIMUMS)
        setWeeklyMinimumsSource('default')
      }
    }

    loadMinimums()
  }, [systemOwnerId, loading])

  useEffect(() => {
    if (!roleLoading && !isManager) {
      navigate('/', { replace: true })
    }
  }, [isManager, roleLoading, navigate])


  // Obtener nombre del asesor
  const getAdvisorName = (advisor: Advisor): string => {
    if (advisor.full_name && advisor.full_name.trim()) {
      return advisor.full_name.trim()
    }
    if (advisor.display_name && advisor.display_name.trim()) {
      return advisor.display_name.trim()
    }
    return `Usuario ${advisor.user_id.slice(0, 8)}`
  }


  const handleAdvisorClick = (advisorId: string) => {
    navigate(`/manager/advisor/${advisorId}?weekStart=${weekStartLocal}`)
  }

  const handleCopySnapshot = async () => {
    const success = await copySnapshot(
      'manager',
      weekStartLocal,
      weekEndLocal,
      weeklyTarget,
      dailyTarget,
      weeklyDays,
      advisorIds
    )
    if (success) {
      setToastMessage('Snapshot copiado')
      setTimeout(() => setToastMessage(null), 2000)
    }
  }

  // Navegación de semanas
  const handlePreviousWeek = () => {
    const prevWeekStart = addDaysYmd(weekStartLocal, -7)
    setSearchParams({ weekStart: prevWeekStart })
  }

  const handleCurrentWeek = () => {
    setSearchParams({})
  }

  const handleNextWeek = () => {
    const nextWeekStart = addDaysYmd(weekStartLocal, 7)
    // Validar que no sea futura
    if (nextWeekStart <= currentWeekRange.weekStartLocal) {
      setSearchParams({ weekStart: nextWeekStart })
    }
  }

  // Verificar si se puede navegar a la semana siguiente
  const canNavigateNext = addDaysYmd(weekStartLocal, 7) <= currentWeekRange.weekStartLocal

  // Calcular alertas del equipo
  const teamAlerts = useMemo(() => {
    return buildTeamAlerts({
      weekStats,
      historyStats,
      weeklyTarget,
    })
  }, [weekStats, historyStats, weeklyTarget])

  // Calcular perfiles de asesores
  const advisorProfiles = useMemo(() => {
    return weekStats.map((stat) => {
      // Obtener métricas del asesor desde eventsWeek
      const advisorEvents = eventsWeek.filter(
        (e) => e.actor_user_id === stat.advisor.user_id && e.value !== null && e.value > 0
      )

      // Construir breakdown de métricas
      const breakdown = buildMetricBreakdown(
        advisorEvents.map((e) => ({ metric_key: e.metric_key, value: e.value || 0 })),
        scoresMap
      )

      // Crear mapa de métricas
      const metrics: Record<string, number> = {}
      breakdown.forEach((row) => {
        metrics[row.metric_key] = row.units
      })

      // Construir perfil
      const profile = buildAdvisorProfile({
        pointsWeek: stat.weekPoints,
        percentOfGoal: stat.percentOfTarget / 100,
        daysActive: stat.daysWithActivity,
        metrics,
        minimums: weeklyMinimums,
      })

      return {
        advisor: stat.advisor,
        profile,
        metrics,
        weekPoints: stat.weekPoints,
        percentOfTarget: stat.percentOfTarget,
      }
    })
  }, [weekStats, eventsWeek, scoresMap, weeklyMinimums, weeklyDays])

  // Contar perfiles
  const profileCounts = useMemo(() => {
    const counts = {
      productive: 0,
      growing: 0,
      intermittent: 0,
      inactive: 0,
    }
    advisorProfiles.forEach((item) => {
      counts[item.profile.key]++
    })
    return counts
  }, [advisorProfiles])

  // Ordenar asesores por perfil (prioridad: inactive > intermittent > growing > productive)
  const sortedAdvisorProfiles = useMemo(() => {
    const order: Record<AdvisorProfileResult['key'], number> = {
      inactive: 0,
      intermittent: 1,
      growing: 2,
      productive: 3,
    }
    return [...advisorProfiles].sort((a, b) => {
      const orderA = order[a.profile.key]
      const orderB = order[b.profile.key]
      if (orderA !== orderB) {
        return orderA - orderB
      }
      // Si mismo perfil, ordenar por puntos desc
      return b.weekPoints - a.weekPoints
    })
  }, [advisorProfiles])

  // Calcular actividad total del equipo (totales por métrica) con metas
  const teamActivityTotals = useMemo(() => {
    const totals = new Map<string, number>()

    // Orden de métricas para mostrar
    const metricOrder = [
      'calls',
      'meetings_set',
      'meetings_held',
      'proposals_presented',
      'applications_submitted',
      'referrals',
      'policies_paid',
    ]

    // Sumar todos los eventos de la semana por métrica
    eventsWeek.forEach((event) => {
      if (event.metric_key && event.value !== null && event.value > 0) {
        const current = totals.get(event.metric_key) || 0
        totals.set(event.metric_key, current + event.value)
      }
    })

    // Calcular meta del equipo (mínimo por asesor * número de asesores)
    const advisorsCount = weekStats.length

    // Construir array de métricas con totales y metas
    return metricOrder
      .filter((key) => totals.has(key) || weeklyMinimums[key] !== undefined)
      .map((key) => {
        const actual = totals.get(key) || 0
        const minimumPerAdvisor = weeklyMinimums[key] || 0
        const teamTarget = minimumPerAdvisor * advisorsCount
        const progressPercent = teamTarget > 0 ? Math.min(100, (actual / teamTarget) * 100) : 0

        return {
          metricKey: key,
          label: getMetricLabel(key, 'long'),
          labelShort: getMetricLabel(key, 'short'),
          total: actual,
          teamTarget,
          progressPercent,
          minimumPerAdvisor,
          tooltip: `Mínimo por asesor: ${minimumPerAdvisor}/semana\nMeta del equipo: ${minimumPerAdvisor} × ${advisorsCount} = ${teamTarget}\nFuente: ${weeklyMinimumsSource === 'db' ? 'Configuración (DB)' : 'Default (hardcode)'}`,
        }
      })
  }, [eventsWeek, weekStats.length, weeklyMinimums, weeklyMinimumsSource])


  if (roleLoading || loading) {
    return (
      <div className="text-center p-8">
        <span className="text-muted">Cargando...</span>
      </div>
    )
  }

  if (!isManager) {
    return (
      <div className="text-center p-8">
        <div className="text-lg font-semibold mb-2">No autorizado</div>
        <div className="text-sm text-muted">Solo los managers pueden acceder a esta vista.</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-4 bg-red-50 border border-red-200">
        <div className="text-sm text-red-700">{error}</div>
        <button onClick={loadData} className="btn btn-primary mt-3 text-sm">
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">Dashboard Manager</h1>
            <p className="text-sm text-muted">Seguimiento operativo del equipo</p>
          </div>
          <div className="flex items-center gap-2">
            {IS_DEV && (
              <button
                onClick={handleCopySnapshot}
                className="px-3 py-1.5 text-xs border border-border rounded bg-bg text-text hover:bg-black/5 transition-colors"
              >
                Copiar snapshot
              </button>
            )}
          </div>
        </div>
        {/* Controles de navegación de semana */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">
            Semana del {formatWeekRangePretty(weekStartLocal, weekEndLocal)}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePreviousWeek}
              className="px-3 py-1.5 text-sm hover:bg-black/5 transition-colors rounded border border-border bg-bg"
            >
              ← Semana anterior
            </button>
            <button
              onClick={handleCurrentWeek}
              className="px-3 py-1.5 text-sm hover:bg-black/5 transition-colors rounded border border-border bg-bg whitespace-nowrap"
            >
              Esta semana
            </button>
            <button
              onClick={handleNextWeek}
              disabled={!canNavigateNext}
              className="px-3 py-1.5 text-sm hover:bg-black/5 transition-colors rounded border border-border bg-bg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Semana siguiente →
            </button>
          </div>
        </div>
      </div>

      {/* Toast para snapshot */}
      {toastMessage && (
        <div className="fixed top-4 right-4 px-4 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700 z-50">
          {toastMessage}
        </div>
      )}


      {weekStats.length === 0 && !loading && (
        <div className="card p-4 bg-gray-50 border border-gray-200">
          <div className="text-sm text-muted">Sin datos</div>
        </div>
      )}

      {/* A) Actividad total del equipo - Arriba */}
      {teamActivityTotals.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted">Actividad total del equipo</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            {/* Primera fila: 4 columnas */}
            {teamActivityTotals.slice(0, 4).map((metric) => {
              const progressColor =
                metric.progressPercent >= 100
                  ? 'bg-green-500'
                  : metric.progressPercent >= 80
                    ? 'bg-gray-300'
                    : 'bg-amber-400'
              return (
                <div key={metric.metricKey} className="card p-2.5 group relative">
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted mb-1">{metric.labelShort}</div>
                      <div className="text-lg font-black">{metric.total.toLocaleString()}</div>
                      <div className="text-[10px] text-muted mt-0.5">Meta equipo: {metric.teamTarget}</div>
                    </div>
                    <div className="w-3 h-3 flex items-center justify-center bg-black/5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-help flex-shrink-0 ml-1">
                      <span className="text-[8px] text-muted">ⓘ</span>
                    </div>
                    <div className="absolute right-0 top-full mt-1 w-64 p-2 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none z-20 shadow-lg whitespace-pre-line">
                      {metric.tooltip}
                      <div className="absolute right-4 top-0 -translate-y-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-black"></div>
                    </div>
                  </div>
                  {metric.teamTarget > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full transition-all ${progressColor}`}
                        style={{ width: `${Math.min(100, metric.progressPercent)}%` }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {/* Segunda fila: 3 columnas (si hay más de 4 métricas) */}
          {teamActivityTotals.length > 4 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {teamActivityTotals.slice(4).map((metric) => {
                const progressColor =
                  metric.progressPercent >= 100
                    ? 'bg-green-500'
                    : metric.progressPercent >= 80
                      ? 'bg-gray-300'
                      : 'bg-amber-400'
                return (
                  <div key={metric.metricKey} className="card p-2.5 group relative">
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted mb-1">{metric.labelShort}</div>
                        <div className="text-lg font-black">{metric.total.toLocaleString()}</div>
                        <div className="text-[10px] text-muted mt-0.5">Meta equipo: {metric.teamTarget}</div>
                      </div>
                      <div className="w-3 h-3 flex items-center justify-center bg-black/5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-help flex-shrink-0 ml-1">
                        <span className="text-[8px] text-muted">ⓘ</span>
                      </div>
                      <div className="absolute right-0 top-full mt-1 w-64 p-2 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none z-20 shadow-lg whitespace-pre-line">
                        {metric.tooltip}
                        <div className="absolute right-4 top-0 -translate-y-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-black"></div>
                      </div>
                    </div>
                    {metric.teamTarget > 0 && (
                      <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all ${progressColor}`}
                          style={{ width: `${Math.min(100, metric.progressPercent)}%` }}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* B) Alertas del equipo - Compacto, no dominante */}
      {teamAlerts.length > 0 && (
        <div className="card p-2">
          <div className="mb-1.5">
            <h3 className="text-xs font-medium text-muted">Alertas del equipo</h3>
          </div>
          <div className="space-y-1">
            {teamAlerts.map((alert) => {
              const severityInfo = getAlertSeverityInfo(alert.severity)
              return (
                <div
                  key={alert.key}
                  className={`flex items-center gap-2 px-2 py-1 rounded text-xs ${severityInfo.bg} ${severityInfo.color}`}
                >
                  <span>{severityInfo.icon}</span>
                  <span>{alert.text}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* C) Tabla Leaderboard Semanal - Principal */}
      <TeamWeeklyLeaderboardTable
        weekStats={weekStats}
        weeklyTarget={weeklyTarget}
        weeklyDays={weeklyDays}
        weekStartLocal={weekStartLocal}
        todayLocal={todayLocal}
        scoresMap={scoresMap}
        eventsWeek={eventsWeek}
        onAdvisorClick={handleAdvisorClick}
        defaultSort="points"
        getAdvisorName={getAdvisorName}
        weeklyMinimums={weeklyMinimums}
      />

      {/* D) Perfil del equipo - Reemplaza Consistencia 12 semanas */}
      <div className="card p-0 overflow-hidden">
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Perfil del equipo</h2>
              <p className="text-xs text-muted mt-0.5">Diagnóstico rápido para dirigir la semana</p>
            </div>
            <div className="group relative">
              <div className="w-5 h-5 flex items-center justify-center bg-black/5 rounded-full cursor-help">
                <span className="text-[10px] text-muted">ⓘ</span>
              </div>
              <div className="absolute right-0 top-full mt-1 w-64 p-2 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none z-20 shadow-lg whitespace-pre-line">
                Productivo: actividad + conversión{'\n'}
                En crecimiento: actividad sólida; falta convertir{'\n'}
                Intermitente: ritmo irregular{'\n'}
                Inactivo: sin actividad registrada
                <div className="absolute right-4 top-0 -translate-y-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-black"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Mini-cards con conteo por perfil */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="card p-3 bg-green-50 border border-green-200">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🔥</span>
                <span className="text-xs font-medium text-green-700">Productivo</span>
              </div>
              <div className="text-xl font-black text-green-700">{profileCounts.productive}</div>
            </div>
            <div className="card p-3 bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🚀</span>
                <span className="text-xs font-medium text-blue-700">En crecimiento</span>
              </div>
              <div className="text-xl font-black text-blue-700">{profileCounts.growing}</div>
            </div>
            <div className="card p-3 bg-amber-50 border border-amber-200">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">⚖️</span>
                <span className="text-xs font-medium text-amber-700">Intermitente</span>
              </div>
              <div className="text-xl font-black text-amber-700">{profileCounts.intermittent}</div>
            </div>
            <div className="card p-3 bg-red-50 border border-red-200">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🚨</span>
                <span className="text-xs font-medium text-red-700">Inactivo</span>
              </div>
              <div className="text-xl font-black text-red-700">{profileCounts.inactive}</div>
            </div>
          </div>

          {/* Lista de asesores */}
          <TeamProfileList
            advisorProfiles={sortedAdvisorProfiles}
            getAdvisorName={getAdvisorName}
            onAdvisorClick={handleAdvisorClick}
            weeklyMinimums={weeklyMinimums}
          />
        </div>
      </div>
    </div>
  )
}

/* 
 * INSTRUCCIONES DE PRUEBA MANUAL:
 * 
 * 1) INSIGHTS ACCIONABLES:
 *    - Verificar que cada fila muestra "Falta" y "Requiere/día"
 *    - Verificar badges de razón (Sin actividad / Ritmo bajo / En camino)
 *    - Verificar que los cards superiores muestran: Total, Promedio, Sin actividad, Ritmo bajo
 * 
 * 2) SORTING Y FILTROS:
 *    - Hacer clic en headers de tabla (Pts, Proyección, Estado, Requiere/día) para ordenar
 *    - Activar toggle "Solo en riesgo" y verificar que filtra correctamente
 * 
 * 3) NAVEGACIÓN A DETALLE:
 *    - Hacer clic en una fila de la tabla semanal
 *    - Debe navegar a /manager/advisor/:id
 *    - Verificar que la página de detalle muestra datos correctos
 *    - Verificar botón "Volver" funciona
 * 
 * 4) DEBUG SNAPSHOT (solo DEV):
 *    - Verificar que botón "Copiar snapshot" aparece solo en desarrollo
 *    - Hacer clic y verificar que se copia JSON al clipboard
 *    - Verificar que aparece toast "Snapshot copiado"
 * 
 * 5) CONSISTENCIA:
 *    - Verificar que tabla de consistencia está ordenada por promedio desc
 *    - Verificar que muestra badge "Consistente" cuando averagePoints >= weeklyTarget
 * 
 * 6) RESPONSIVE:
 *    - Verificar que tablas se adaptan en mobile/tablet
 *    - Verificar que cards se apilan correctamente
 * 
 * 7) QUÉ HACER HOY (columna "Hoy"):
 *    - Asesor con requiredDailyAvg > 0: debe mostrar plan (ej. "2 Llamadas · 1 Citas agendadas · 1 Propuestas presentadas")
 *    - Asesor sin actividad (riskReason="no_activity"): debe mostrar kickstart (ej. "1 Llamadas (Arranque)")
 *    - Asesor con requiredDailyAvg = 0: debe mostrar "✅" o "Mantener"
 *    - Hover sobre columna "Hoy" debe mostrar tooltip con desglose (requerido, distribución, omitidas)
 * 
 * 8) ALERTAS DEL EQUIPO:
 *    - Verificar que sección "Alertas del equipo" aparece arriba de las tablas
 *    - Verificar que muestra alertas relevantes (sin actividad, proyección baja, top 1, promedio, consistentes)
 *    - Verificar colores según severity (risk=rojo, warn=ámbar, good=verde, info=azul)
 */
