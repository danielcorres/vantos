/**
 * Hook compartido para dashboards de OKR por equipo (Owner y Manager)
 * Reutiliza exactamente la misma lógica de cálculo
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { okrQueries } from '../data/okrQueries'
import { todayLocalYmd } from '../../../shared/utils/dates'
import { getLastNWeekStarts, calcWeekRangeLocal } from '../utils/weeklyHistoryHelpers'
import {
  buildScoresMap,
  computeAdvisorWeekStats,
  computeAdvisorHistoryStats,
  getScopedAdvisors,
  getScopedAdvisorsForManager,
  type Advisor,
  type AdvisorWeekStats,
  type AdvisorHistoryStats,
} from '../../../pages/owner/utils/ownerDashboardHelpers'

export interface UseTeamOkrDashboardOptions {
  mode: 'owner' | 'manager'
  managerUserId?: string // Requerido si mode === 'manager'
  filters?: {
    managerId?: string | null
    recruiterId?: string | null
  } // Solo usado si mode === 'owner'
  weekStartLocal?: string // YYYY-MM-DD (lunes) - Si se proporciona, usa esta semana en vez de la actual
}

export interface UseTeamOkrDashboardResult {
  weekStats: AdvisorWeekStats[]
  historyStats: AdvisorHistoryStats[]
  dailyTarget: number
  weeklyDays: number
  weeklyTarget: number
  weekStartLocal: string
  weekEndLocal: string
  nextWeekStartLocal: string
  todayLocal: string
  advisorIds: string[]
  scoresMap: Map<string, number>
  eventsWeek: Array<{ recorded_at: string; metric_key: string; value: number | null; actor_user_id: string }>
  loading: boolean
  error: string | null
  reload: () => void
}

export function useTeamOkrDashboard(
  options: UseTeamOkrDashboardOptions
): UseTeamOkrDashboardResult {
  const { mode, managerUserId, filters } = options

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [weekStats, setWeekStats] = useState<AdvisorWeekStats[]>([])
  const [historyStats, setHistoryStats] = useState<AdvisorHistoryStats[]>([])
  const [dailyTarget, setDailyTarget] = useState(25)
  const [weeklyDays, setWeeklyDays] = useState(5)
  const [advisorIds, setAdvisorIds] = useState<string[]>([])
  const [scoresMap, setScoresMap] = useState<Map<string, number>>(new Map())
  const [eventsWeek, setEventsWeek] = useState<Array<{ recorded_at: string; metric_key: string; value: number | null; actor_user_id: string }>>([])

  const mountedRef = useRef(true)
  const loadInProgressRef = useRef(false)

  const todayLocal = todayLocalYmd()
  const { weekStartLocal, weekEndLocal, nextWeekStartLocal } = calcWeekRangeLocal(options.weekStartLocal)

  const loadData = useCallback(async () => {
    if (!mountedRef.current || loadInProgressRef.current) return

    loadInProgressRef.current = true
    setLoading(true)
    setError(null)

    try {
      // Obtener advisors en scope según mode
      let scopedAdvisorIds: string[]

      if (mode === 'manager') {
        if (!managerUserId) {
          throw new Error('managerUserId es requerido para mode="manager"')
        }
        scopedAdvisorIds = await getScopedAdvisorsForManager(managerUserId)
      } else {
        // mode === 'owner'
        scopedAdvisorIds = await getScopedAdvisors({
          managerId: filters?.managerId ?? null,
          recruiterId: filters?.recruiterId ?? null,
        })
      }

      if (!mountedRef.current) {
        loadInProgressRef.current = false
        return
      }

      if (scopedAdvisorIds.length === 0) {
        if (mountedRef.current) {
          setWeekStats([])
          setHistoryStats([])
          setAdvisorIds([])
          setLoading(false)
        }
        loadInProgressRef.current = false
        return
      }

      // Query: Traer datos completos de advisors en scope
      const { data: advisorsData, error: advisorsError } = await supabase
        .from('profiles')
        .select('user_id, full_name, display_name, role')
        .in('user_id', scopedAdvisorIds)
        .order('full_name', { ascending: true, nullsFirst: false })
        .order('display_name', { ascending: true, nullsFirst: false })

      if (advisorsError) throw advisorsError

      const advisorsList: Advisor[] = (advisorsData || []).map((p) => ({
        user_id: p.user_id,
        full_name: p.full_name,
        display_name: p.display_name,
        role: p.role,
      }))

      if (!mountedRef.current) {
        loadInProgressRef.current = false
        return
      }

      const advisorIds = advisorsList.map((a) => a.user_id)

      // Query 2 y 3: Settings y scores globales
      const [settings, scores] = await Promise.all([
        okrQueries.getOkrSettingsGlobal(),
        okrQueries.getMetricScores(),
      ])

      if (!mountedRef.current) {
        loadInProgressRef.current = false
        return
      }

      // Actualizar settings (necesario para calcular weeklyTarget correctamente)
      setDailyTarget(settings.daily_base_target)
      setWeeklyDays(settings.weekly_days)

      const scoresMap = buildScoresMap(scores)
      const currentWeeklyTarget = settings.daily_base_target * settings.weekly_days

      // Query 4: Eventos de semana actual
      // Convertir YYYY-MM-DD local (Monterrey) a UTC
      // 00:00 Monterrey (UTC-6) = 06:00 UTC
      const [startYear, startMonth, startDay] = weekStartLocal.split('-').map(Number)
      const [nextYear, nextMonth, nextDay] = nextWeekStartLocal.split('-').map(Number)

      const weekStartUTC = new Date(Date.UTC(startYear, startMonth - 1, startDay, 6, 0, 0))
      const nextWeekUTC = new Date(Date.UTC(nextYear, nextMonth - 1, nextDay, 6, 0, 0))

      const { data: eventsWeek, error: eventsWeekError } = await supabase
        .from('activity_events')
        .select('recorded_at, metric_key, value, actor_user_id')
        .in('actor_user_id', advisorIds)
        .eq('is_void', false)
        .eq('source', 'manual')
        .gte('recorded_at', weekStartUTC.toISOString())
        .lt('recorded_at', nextWeekUTC.toISOString())
        .order('recorded_at', { ascending: true })

      if (eventsWeekError) throw eventsWeekError

      if (!mountedRef.current) {
        loadInProgressRef.current = false
        return
      }

      // Guardar eventos de la semana
      setEventsWeek(eventsWeek || [])

      // Query 5: Eventos de últimas 12 semanas
      // Anclar histórico desde weekStartLocal si está presente, sino desde todayLocal
      const anchorDate = options.weekStartLocal || todayLocal
      const weekStarts = getLastNWeekStarts(anchorDate, 12)
      const oldestWeekStart = weekStarts[weekStarts.length - 1]
      const [oldestYear, oldestMonth, oldestDay] = oldestWeekStart.split('-').map(Number)
      // 00:00 Monterrey (UTC-6) = 06:00 UTC
      const oldestUTC = new Date(Date.UTC(oldestYear, oldestMonth - 1, oldestDay, 6, 0, 0))

      const { data: events12w, error: events12wError } = await supabase
        .from('activity_events')
        .select('recorded_at, metric_key, value, actor_user_id')
        .in('actor_user_id', advisorIds)
        .eq('is_void', false)
        .eq('source', 'manual')
        .gte('recorded_at', oldestUTC.toISOString())
        .lt('recorded_at', nextWeekUTC.toISOString())
        .order('recorded_at', { ascending: true })

      if (events12wError) throw events12wError

      if (!mountedRef.current) {
        loadInProgressRef.current = false
        return
      }

      // Calcular estadísticas semanales (reutilizando exactamente la misma lógica)
      const weekStatsList: AdvisorWeekStats[] = []
      advisorsList.forEach((advisor) => {
        const stats = computeAdvisorWeekStats(
          eventsWeek || [],
          advisor.user_id,
          scoresMap,
          currentWeeklyTarget,
          settings.weekly_days,
          todayLocal,
          weekStartLocal,
          weekEndLocal
        )
        if (stats) {
          stats.advisor = advisor
          weekStatsList.push(stats)
        } else {
          // Asesor sin actividad esta semana
          weekStatsList.push({
            advisor,
            weekPoints: 0,
            weekPointsUntilToday: 0,
            daysWithActivity: 0,
            currentRhythm: 0,
            projection: 0,
            percentOfTarget: 0,
            status: 'at_risk',
          })
        }
      })

      // Calcular estadísticas históricas (reutilizando exactamente la misma lógica)
      const historyStatsList: AdvisorHistoryStats[] = []
      advisorsList.forEach((advisor) => {
        const stats = computeAdvisorHistoryStats(
          events12w || [],
          advisor.user_id,
          scoresMap,
          currentWeeklyTarget
        )
        if (stats) {
          stats.advisor = advisor
          historyStatsList.push(stats)
        } else {
          // Asesor sin actividad histórica
          historyStatsList.push({
            advisor,
            weeksCompleted: 0,
            averagePoints: 0,
            bestWeek: 0,
          })
        }
      })

      // Ordenar por puntos desc
      weekStatsList.sort((a, b) => b.weekPoints - a.weekPoints)

      if (mountedRef.current) {
        setWeekStats(weekStatsList)
        setHistoryStats(historyStatsList)
        setAdvisorIds(advisorIds)
        setScoresMap(scoresMap)
        // eventsWeek ya se guardó arriba
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
      loadInProgressRef.current = false
    }
  }, [mode, managerUserId, filters?.managerId, filters?.recruiterId, options.weekStartLocal, weekStartLocal, weekEndLocal, nextWeekStartLocal, todayLocal])

  const reload = useCallback(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    mountedRef.current = true
    loadData()

    return () => {
      mountedRef.current = false
    }
  }, [loadData])

  // Calcular weeklyTarget actualizado (después de que settings se carguen)
  const currentWeeklyTarget = dailyTarget * weeklyDays

  return {
    weekStats,
    historyStats,
    dailyTarget,
    weeklyDays,
    weeklyTarget: currentWeeklyTarget,
    weekStartLocal,
    weekEndLocal,
    nextWeekStartLocal,
    todayLocal,
    advisorIds,
    scoresMap,
    eventsWeek, // Exponer eventos para cálculo de métricas
    loading,
    error,
    reload,
  }
}
