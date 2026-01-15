/**
 * Página de detalle semanal de un asesor (read-only)
 * Para managers y owners ver el desempeño de un asesor específico
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { okrQueries } from '../../modules/okr/data/okrQueries'
import { useUserRole } from '../../shared/hooks/useUserRole'
import { todayLocalYmd, timestampToYmdInTz, addDaysYmd } from '../../shared/utils/dates'
import {
  buildScoresMap,
  calcWeekRangeLocal,
  computeAdvisorWeekStats,
  type Advisor,
} from '../owner/utils/ownerDashboardHelpers'
import {
  buildMetricBreakdown,
  buildFulfillmentPlan,
} from '../../modules/okr/dashboard/advisorDetailHelpers'
import { getMetricLabel } from '../../modules/okr/domain/metricLabels'
import {
  calculateAdvisorInsight,
} from '../../modules/okr/dashboard/teamDashboardInsights'
import {
  getPrevWeekRangeLocal,
  fetchEventsForRange,
} from '../../modules/okr/dashboard/weekCompareHelpers'

export function AdvisorWeekDetailPage() {
  const { advisorId } = useParams<{ advisorId: string }>()
  const navigate = useNavigate()
  const { role, loading: roleLoading } = useUserRole()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [advisor, setAdvisor] = useState<Advisor | null>(null)
  const [weekPoints, setWeekPoints] = useState(0)
  const [daysWithActivity, setDaysWithActivity] = useState(0)
  const [projection, setProjection] = useState(0)
  const [percentOfTarget, setPercentOfTarget] = useState(0)
  const [status, setStatus] = useState<'excellent' | 'completed' | 'on_track' | 'at_risk'>('at_risk')
  const [dailyTarget, setDailyTarget] = useState(25)
  const [weeklyDays, setWeeklyDays] = useState(5)
  const [eventsWeek, setEventsWeek] = useState<Array<{ recorded_at: string; metric_key: string; value: number }>>([])
  const [prevStats, setPrevStats] = useState<{ weekPoints: number; daysWithActivity: number } | null>(null)
  const [scoresMap, setScoresMap] = useState<Map<string, number>>(new Map())
  const mountedRef = useRef(true)
  const [searchParams] = useSearchParams()

  const isManager = role === 'manager' || role === 'owner'
  const todayLocal = todayLocalYmd()
  const { weekStartLocal, weekEndLocal, nextWeekStartLocal } = calcWeekRangeLocal()
  const weeklyTarget = dailyTarget * weeklyDays

  // Convertir loadData a useCallback para evitar stale closures y doble fetch en StrictMode
  const loadData = useCallback(async () => {
    if (!advisorId || !mountedRef.current) return

    setLoading(true)
    setError(null)

    try {
      // Cargar perfil del asesor
      const { data: advisorData, error: advisorError } = await supabase
        .from('profiles')
        .select('user_id, full_name, display_name, role')
        .eq('user_id', advisorId)
        .single()

      if (advisorError) throw advisorError

      if (!mountedRef.current) return

      const advisorObj: Advisor = {
        user_id: advisorData.user_id,
        full_name: advisorData.full_name,
        display_name: advisorData.display_name,
        role: advisorData.role,
      }
      setAdvisor(advisorObj)

      // Cargar settings y scores
      const [settings, scores] = await Promise.all([
        okrQueries.getOkrSettingsGlobal(),
        okrQueries.getMetricScores(),
      ])

      if (!mountedRef.current) return

      setDailyTarget(settings.daily_base_target)
      setWeeklyDays(settings.weekly_days)
      const currentScoresMap = buildScoresMap(scores)
      setScoresMap(currentScoresMap)
      const currentWeeklyTarget = settings.daily_base_target * settings.weekly_days

      // Cargar eventos de la semana actual y anterior en paralelo
      const [startYear, startMonth, startDay] = weekStartLocal.split('-').map(Number)
      const [nextYear, nextMonth, nextDay] = nextWeekStartLocal.split('-').map(Number)

      const weekStartUTC = new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0))
      const nextWeekUTC = new Date(Date.UTC(nextYear, nextMonth - 1, nextDay, 0, 0, 0))

      // Obtener rango de semana anterior
      const { prevWeekStartLocal, prevWeekEndLocal, prevNextWeekStartLocal } = getPrevWeekRangeLocal(weekStartLocal)

      // Cargar eventos en paralelo
      const [eventsWeekRes, eventsPrevWeekRes] = await Promise.all([
        supabase
          .from('activity_events')
          .select('recorded_at, metric_key, value, actor_user_id')
          .eq('actor_user_id', advisorId)
          .eq('is_void', false)
          .eq('source', 'manual')
          .gte('recorded_at', weekStartUTC.toISOString())
          .lt('recorded_at', nextWeekUTC.toISOString())
          .order('recorded_at', { ascending: true }),
        fetchEventsForRange({
          supabase,
          advisorIds: [advisorId],
          fromYmdInclusive: prevWeekStartLocal,
          toYmdExclusive: prevNextWeekStartLocal,
        }),
      ])

      if (eventsWeekRes.error) throw eventsWeekRes.error

      if (!mountedRef.current) return

      // Guardar eventos para los bloques de detalle (formato simplificado para los helpers)
      if (mountedRef.current) {
        setEventsWeek((eventsWeekRes.data || []).map((e) => ({
          recorded_at: e.recorded_at,
          metric_key: e.metric_key,
          value: e.value ?? 0,
        })))
      }

      // Calcular stats de semana anterior
      // Convertir eventos a formato esperado por computeAdvisorWeekStats (value puede ser null)
      const prevEventsFormatted = (eventsPrevWeekRes || []).map((e) => ({
        recorded_at: e.recorded_at,
        metric_key: e.metric_key,
        value: e.value ?? null,
        actor_user_id: e.actor_user_id,
      }))
      
      const prevStatsResult = computeAdvisorWeekStats(
        prevEventsFormatted,
        advisorId,
        currentScoresMap,
        currentWeeklyTarget,
        settings.weekly_days,
        todayLocal,
        prevWeekStartLocal,
        prevWeekEndLocal
      )

      if (mountedRef.current) {
        if (prevStatsResult) {
          setPrevStats({
            weekPoints: prevStatsResult.weekPoints,
            daysWithActivity: prevStatsResult.daysWithActivity,
          })
        } else {
          setPrevStats(null)
        }
      }

      // Calcular estadísticas
      // Convertir eventos a formato esperado por computeAdvisorWeekStats
      const eventsWeekFormatted = (eventsWeekRes.data || []).map((e) => ({
        recorded_at: e.recorded_at,
        metric_key: e.metric_key,
        value: e.value ?? null,
        actor_user_id: e.actor_user_id,
      }))
      
      const stats = computeAdvisorWeekStats(
        eventsWeekFormatted,
        advisorId,
        currentScoresMap,
        currentWeeklyTarget,
        settings.weekly_days,
        todayLocal,
        weekStartLocal,
        weekEndLocal
      )

      if (mountedRef.current) {
        if (stats) {
          setWeekPoints(stats.weekPoints)
          setDaysWithActivity(stats.daysWithActivity)
          setProjection(stats.projection)
          setPercentOfTarget(stats.percentOfTarget)
          setStatus(stats.status)
        } else {
          // Sin actividad
          setWeekPoints(0)
          setDaysWithActivity(0)
          setProjection(0)
          setPercentOfTarget(0)
          setStatus('at_risk')
        }
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        const errorMessage = err instanceof Error ? err.message : 'Error al cargar datos'
        setError(errorMessage)
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [advisorId, weekStartLocal, nextWeekStartLocal, todayLocal, weekEndLocal])

  useEffect(() => {
    mountedRef.current = true

    if (!roleLoading && !isManager) {
      navigate('/', { replace: true })
      return
    }

    if (isManager && !roleLoading && advisorId) {
      loadData()
    }

    return () => {
      mountedRef.current = false
    }
  }, [isManager, roleLoading, advisorId, navigate, loadData])

  // Scroll a bloque específico si hay focus en URL
  useEffect(() => {
    const focus = searchParams.get('focus')
    if (focus && !loading) {
      setTimeout(() => {
        const element = document.getElementById(focus === 'fulfillment' ? 'fulfillment-plan' : focus)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
    }
  }, [searchParams, loading])

  // TODOS LOS HOOKS DEBEN ESTAR ANTES DE CUALQUIER RETURN
  // Convertir getStatusInfo a useMemo con default case
  const statusInfo = useMemo(() => {
    switch (status) {
      case 'excellent':
        return { label: '🔥', color: 'text-purple-600', bg: 'bg-purple-50' }
      case 'completed':
        return { label: '✅', color: 'text-green-600', bg: 'bg-green-50' }
      case 'on_track':
        return { label: 'En camino', color: 'text-green-600', bg: 'bg-green-50' }
      case 'at_risk':
        return { label: 'En riesgo', color: 'text-red-600', bg: 'bg-red-50' }
      default:
        return { label: 'En riesgo', color: 'text-red-600', bg: 'bg-red-50' }
    }
  }, [status])

  // Calcular insight usando días hábiles reales (safe: retorna null si no hay advisor)
  const insight = useMemo(() => {
    if (!advisor) return null
    
    // Calcular weekPointsUntilToday desde eventos
    const todayYmd = todayLocal
    const todayEvents = eventsWeek.filter((event) => {
      const eventDate = new Date(event.recorded_at)
      const eventYmd = timestampToYmdInTz(eventDate, 'America/Monterrey')
      return eventYmd <= todayYmd
    })
    
    let weekPointsUntilToday = 0
    todayEvents.forEach((event) => {
      const pointsPerUnit = scoresMap.get(event.metric_key) || 0
      weekPointsUntilToday += event.value * pointsPerUnit
    })
    
    const stat = {
      advisor,
      weekPoints,
      weekPointsUntilToday,
      daysWithActivity,
      currentRhythm: daysWithActivity > 0 ? weekPoints / daysWithActivity : 0,
      projection,
      percentOfTarget,
      status,
    }
    return calculateAdvisorInsight(stat, weeklyTarget, weeklyDays, weekStartLocal, todayLocal)
  }, [advisor, weekPoints, daysWithActivity, projection, percentOfTarget, status, weeklyTarget, weeklyDays, weekStartLocal, todayLocal, eventsWeek, scoresMap])

  // Construir los 3 bloques (safe: retornan [] o valores por defecto)
  const metricBreakdown = useMemo(() => {
    if (!eventsWeek.length || scoresMap.size === 0) return []
    return buildMetricBreakdown(eventsWeek, scoresMap)
  }, [eventsWeek, scoresMap])

  // Procesar eventos directamente para mostrar TODAS las métricas del día (sin truncar ni agrupar)
  const dailyTimeline = useMemo(() => {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
    const TIMEZONE = 'America/Monterrey'
    
    // Orden operativo natural de métricas
    const metricOrder = [
      'calls',
      'meetings_set',
      'meetings_held',
      'proposals_presented',
      'applications_submitted',
      'referrals',
      'policies_paid',
    ]
    
    // Crear 7 días (lunes-domingo)
    const rows = Array.from({ length: 7 }, (_, i) => {
      const dateYmd = addDaysYmd(weekStartLocal, i)
      const [y, m, d] = dateYmd.split('-').map(Number)
      const utcDate = new Date(Date.UTC(y, m - 1, d))
      const dayOfWeek = utcDate.getUTCDay()
      const dayNumber = d
      
      return {
        dayLabel: `${days[dayOfWeek]} ${dayNumber}`,
        dateYmd,
        points: 0,
        activities: [] as Array<{ metricKey: string; units: number; label: string }>,
        status: '0 pts',
      }
    })
    
    if (!eventsWeek.length || scoresMap.size === 0) {
      return rows.map(row => ({
        ...row,
        activity: '',
      }))
    }
    
    // Agrupar eventos por día local
    const eventsByDay = new Map<string, Array<{ metric_key: string; value: number }>>()
    eventsWeek.forEach((event) => {
      const eventDate = new Date(event.recorded_at)
      const dayYmd = timestampToYmdInTz(eventDate, TIMEZONE)
      const existing = eventsByDay.get(dayYmd) || []
      existing.push({ metric_key: event.metric_key, value: event.value })
      eventsByDay.set(dayYmd, existing)
    })
    
    // Procesar cada día
    rows.forEach((row) => {
      const dayEvents = eventsByDay.get(row.dateYmd) || []
      
      if (dayEvents.length === 0) {
        row.points = 0
        row.activities = []
        row.status = '0 pts'
        return
      }
      
      // Agrupar por métrica y sumar unidades
      const metricMap = new Map<string, number>()
      dayEvents.forEach((event) => {
        const current = metricMap.get(event.metric_key) || 0
        metricMap.set(event.metric_key, current + event.value)
      })
      
      // Calcular puntos totales
      let dayPoints = 0
      metricMap.forEach((units, metricKey) => {
        const pointsPerUnit = scoresMap.get(metricKey) || 0
        dayPoints += units * pointsPerUnit
      })
      row.points = dayPoints
      
      // Construir lista completa de actividades en orden operativo natural
      row.activities = metricOrder
        .filter((key) => metricMap.has(key))
        .map((key) => {
          const units = metricMap.get(key) || 0
          return {
            metricKey: key,
            units,
            label: getMetricLabel(key, 'long'),
          }
        })
      
      row.status = dayPoints > 0 ? 'Activo' : '0 pts'
    })
    
    return rows.map(row => ({
      ...row,
      activity: '', // Mantener compatibilidad con estructura existente
    }))
  }, [eventsWeek, scoresMap, weekStartLocal])

  const fulfillmentPlan = useMemo(() => {
    if (!insight) {
      return { rows: [], tomorrowRequired: null }
    }
    return buildFulfillmentPlan({
      pointsRemaining: insight.pointsRemaining,
      daysRemaining: insight.daysRemaining,
      riskReason: insight.riskReason,
      scoresMap,
      todayLocal,
      weekEndLocal,
    })
  }, [insight, scoresMap, todayLocal, weekEndLocal])

  // Helper function (no hook, puede estar después)
  const getAdvisorName = (): string => {
    if (!advisor) return 'Asesor'
    if (advisor.full_name && advisor.full_name.trim()) {
      return advisor.full_name.trim()
    }
    if (advisor.display_name && advisor.display_name.trim()) {
      return advisor.display_name.trim()
    }
    return `Usuario ${advisor.user_id.slice(0, 8)}`
  }

  // RETURNS TEMPRANOS (después de todos los hooks)
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

  if (!advisor) {
    return (
      <div className="text-center p-8">
        <div className="text-lg font-semibold mb-2">Asesor no encontrado</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Detalle Semanal: {getAdvisorName()}</h1>
          <p className="text-sm text-muted">Semana: {weekStartLocal} - {weekEndLocal}</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 text-sm border border-border rounded bg-bg text-text hover:bg-black/5 transition-colors"
        >
          Volver
        </button>
      </div>

      {/* Comparativo semana pasada */}
      {prevStats ? (
        <div className="card p-4 bg-blue-50 border border-blue-200">
          <div className="text-sm font-semibold text-blue-800 mb-2">Comparativo vs Semana Anterior</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-xs text-blue-600 mb-1">Semana pasada</div>
              <div className="font-semibold text-blue-800">{Math.round(prevStats.weekPoints)} pts</div>
            </div>
            <div>
              <div className="text-xs text-blue-600 mb-1">Δ Puntos</div>
              <div className={`font-semibold ${
                weekPoints > prevStats.weekPoints ? 'text-green-600' :
                weekPoints < prevStats.weekPoints ? 'text-red-600' :
                'text-blue-800'
              }`}>
                {weekPoints > prevStats.weekPoints ? `+${Math.round(weekPoints - prevStats.weekPoints)}` :
                 weekPoints < prevStats.weekPoints ? `${Math.round(weekPoints - prevStats.weekPoints)}` :
                 '0'}
              </div>
            </div>
            <div>
              <div className="text-xs text-blue-600 mb-1">Días pasada</div>
              <div className="font-semibold text-blue-800">{prevStats.daysWithActivity} días</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card p-4 bg-gray-50 border border-gray-200">
          <div className="text-sm text-muted">Semana pasada: —</div>
        </div>
      )}

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card p-4">
          <div className="text-xs text-muted mb-1">Puntos Semana</div>
          <div className="text-2xl font-black">{Math.round(weekPoints)}</div>
          <div className="text-xs text-muted mt-1">de {weeklyTarget} pts</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-muted mb-1">Días con Actividad</div>
          <div className="text-2xl font-black">{daysWithActivity}</div>
          <div className="text-xs text-muted mt-1">de {weeklyDays} días</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-muted mb-1">Proyección</div>
          <div className="text-2xl font-black">{Math.round(projection)}</div>
          <div className="text-xs text-muted mt-1">{Math.round(percentOfTarget)}%</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-muted mb-1">Estado</div>
          <div className="text-xl font-black">
            <span className={`px-2 py-1 rounded text-sm font-medium ${statusInfo.bg} ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
        </div>
      </div>

      {/* Insights Accionables */}
      {insight && insight.pointsRemaining > 0 && (
        <div className="card p-4 bg-amber-50 border border-amber-200">
          <div className="text-sm font-semibold text-amber-800 mb-2">Acción Requerida</div>
          <div className="space-y-1 text-sm text-amber-700">
            <div>Faltan: <span className="font-semibold">{Math.round(insight.pointsRemaining)} pts</span></div>
            <div>Días restantes: <span className="font-semibold">{insight.daysRemaining}</span></div>
            {insight.requiredDailyAvg > 0 && (
              <div>Promedio requerido: <span className="font-semibold">{Math.round(insight.requiredDailyAvg)} pts/día</span></div>
            )}
          </div>
        </div>
      )}

      {/* BLOQUE 1: Desglose por métrica */}
      <div id="metric-breakdown" className="card p-0 overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Desglose por métrica</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg border-b border-border">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase">Métrica</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase">Unidades</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase">Puntos</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase">% del total</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase">Pts/Unidad</th>
              </tr>
            </thead>
            <tbody>
              {metricBreakdown.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 px-4 text-muted">
                    No hay actividad registrada esta semana
                  </td>
                </tr>
              ) : (
                metricBreakdown.map((row) => (
                  <tr key={row.metric_key} className="border-b border-border hover:bg-bg">
                    <td className="py-3 px-4 font-medium capitalize">{row.metric_label}</td>
                    <td className="py-3 px-4 text-right">{row.units}</td>
                    <td className="py-3 px-4 text-right font-semibold">{Math.round(row.points)}</td>
                    <td className="py-3 px-4 text-right text-muted">{Math.round(row.percentOfTotal)}%</td>
                    <td className="py-3 px-4 text-right text-muted">
                      {row.pointsPerUnit !== null ? `${row.pointsPerUnit}` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* BLOQUE 2: Línea de tiempo semanal */}
      <div id="daily-timeline" className="card p-0 overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Semana día a día</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg border-b border-border">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase">Día</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase">Puntos</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase">Actividad</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-muted uppercase">Estado</th>
              </tr>
            </thead>
            <tbody>
              {dailyTimeline.map((row) => {
                return (
                  <tr key={row.dateYmd} className="border-b border-border hover:bg-bg">
                    <td className="py-3 px-4 font-medium">{row.dayLabel}</td>
                    <td className="py-3 px-4 text-right font-semibold">{Math.round(row.points)}</td>
                    <td className="py-3 px-4">
                      {row.activities && row.activities.length > 0 ? (
                        <ul className="space-y-1 text-sm text-muted">
                          {row.activities.map((activity, idx) => (
                            <li key={idx} className="flex items-center gap-2">
                              <span className="text-muted">•</span>
                              <span>{activity.units} {activity.label}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        row.status === 'Activo' ? 'bg-green-50 text-green-600' : 'bg-gray-50 text-gray-600'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* BLOQUE 3: Plan para cumplir */}
      <div id="fulfillment-plan" className="card p-4">
        <h2 className="text-lg font-semibold mb-3">Plan para cumplir</h2>
        {fulfillmentPlan.rows.length === 0 ? (
          <div className="text-sm text-muted">No hay días restantes en la semana.</div>
        ) : (
          <div className="space-y-3">
            <ul className="space-y-2 text-sm">
              {fulfillmentPlan.rows.map((row) => (
                <li key={row.dateYmd} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                  <div className="flex items-center gap-3">
                    <span className="font-medium w-20">{row.dayLabel}:</span>
                    <span className="text-muted">{row.planLabel}</span>
                  </div>
                  {row.requiredDailyAvg > 0 && (
                    <span className="text-xs text-amber-600 font-medium">
                      {Math.round(row.requiredDailyAvg)} pts/día
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {fulfillmentPlan.tomorrowRequired !== null && fulfillmentPlan.tomorrowRequired > 0 && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-700">
                <div className="font-semibold mb-1">Simulación:</div>
                <div>Si cumple hoy → mañana requiere: <span className="font-semibold">{Math.round(fulfillmentPlan.tomorrowRequired)} pts/día</span></div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* DEBUG: Totales (solo en DEV) */}
      {import.meta.env.DEV && (
        <div className="card p-4 bg-gray-50 border border-gray-200">
          <h3 className="text-sm font-semibold mb-2">🔍 Debug Totales</h3>
          <div className="space-y-1 text-xs">
            <div>weekPoints: <span className="font-mono">{Math.round(weekPoints)}</span></div>
            <div>
              totalBreakdownPoints:{' '}
              <span className="font-mono">
                {Math.round(metricBreakdown.reduce((sum, row) => sum + row.points, 0))}
              </span>
            </div>
            <div>
              totalTimelinePoints:{' '}
              <span className="font-mono">
                {Math.round(dailyTimeline.reduce((sum, row) => sum + row.points, 0))}
              </span>
            </div>
            {(() => {
              const breakdownTotal = metricBreakdown.reduce((sum, row) => sum + row.points, 0)
              const timelineTotal = dailyTimeline.reduce((sum, row) => sum + row.points, 0)
              const diff1 = Math.abs(weekPoints - breakdownTotal)
              const diff2 = Math.abs(weekPoints - timelineTotal)
              const diff3 = Math.abs(breakdownTotal - timelineTotal)
              const maxDiff = Math.max(diff1, diff2, diff3)
              if (maxDiff <= 1) {
                return <div className="mt-2 text-green-600 font-semibold">✅ Totales OK</div>
              }
              return (
                <div className="mt-2 text-amber-600 font-semibold">
                  ⚠️ Diferencia: {maxDiff.toFixed(2)} pts
                </div>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
}

/*
 * CHECKLIST DE PRUEBAS:
 * 
 * 1) Abrir detalle de asesor con actividad:
 *    - Timeline debe mostrar 7 días (lunes-domingo)
 *    - Suma de puntos en timeline debe coincidir con weekPoints (card)
 *    - Suma de puntos en breakdown debe coincidir con weekPoints
 *    - Debug totals (DEV) debe mostrar "✅ Totales OK" o diferencia <= 1
 * 
 * 2) Abrir asesor sin actividad:
 *    - Timeline debe mostrar 7 días en 0 puntos
 *    - Breakdown debe estar vacío o mostrar "No hay actividad registrada"
 *    - Plan debe mostrar "✅ Mantener" o requerido correcto según daysRemaining
 * 
 * 3) Cambiar TZ del sistema/navegador (si es posible):
 *    - Labels de días (Lun, Mar, etc.) no deben desfasarse
 *    - Agrupación de eventos por día debe seguir siendo correcta
 *    - dateYmd debe coincidir con el día real en Monterrey
 * 
 * 4) Ver consola del navegador:
 *    - NO debe aparecer "Rendered more hooks than during the previous render"
 *    - NO debe haber warnings de React hooks
 *    - NO debe haber errores de TypeScript
 * 
 * 5) Validar que loadData no se ejecute múltiples veces en StrictMode:
 *    - Abrir DevTools Network tab
 *    - Recargar página
 *    - Verificar que las queries a Supabase se ejecutan solo una vez (no duplicadas)
 */
