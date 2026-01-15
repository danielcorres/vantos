/**
 * Helpers para calcular estadísticas del dashboard owner
 */

import { timestampToYmdInTz, TZ_MTY, todayLocalYmd, addDaysYmd } from '../../../shared/utils/dates'
import { groupEventsByWeek } from '../../../modules/okr/utils/weeklyHistoryHelpers'
import { supabase } from '../../../lib/supabaseClient'

export interface Advisor {
  user_id: string
  full_name: string | null
  display_name: string | null
  role: string
}

export interface AdvisorWeekStats {
  advisor: Advisor
  weekPoints: number
  weekPointsUntilToday: number
  daysWithActivity: number
  currentRhythm: number
  projection: number
  percentOfTarget: number
  status: 'excellent' | 'completed' | 'on_track' | 'at_risk'
}

export interface AdvisorHistoryStats {
  advisor: Advisor
  weeksCompleted: number
  averagePoints: number
  bestWeek: number
}

/**
 * Obtener lista de advisors en scope según filtros de manager/recruiter
 * (Usado por Owner Dashboard con filtros opcionales)
 */
export async function getScopedAdvisors(options?: {
  managerId?: string | null
  recruiterId?: string | null
}): Promise<string[]> {
  let query = supabase
    .from('profiles')
    .select('user_id')
    .eq('role', 'advisor')

  if (options?.managerId) {
    query = query.eq('manager_user_id', options.managerId)
  }

  if (options?.recruiterId) {
    query = query.eq('recruiter_user_id', options.recruiterId)
  }

  const { data, error } = await query

  if (error) {
    console.error('[getScopedAdvisors] Error:', error)
    return []
  }

  return (data || []).map((p) => p.user_id)
}

/**
 * Obtener lista de advisors para un manager específico (scope fijo)
 * (Usado por Manager Dashboard - siempre filtra por managerUserId)
 */
export async function getScopedAdvisorsForManager(managerUserId: string): Promise<string[]> {
  const IS_DEV = import.meta.env.DEV

  if (IS_DEV) {
    console.debug('[getScopedAdvisorsForManager] managerUserId:', managerUserId)
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('role', 'advisor')
    .eq('manager_user_id', managerUserId)

  if (error) {
    console.error('[getScopedAdvisorsForManager] Error:', error)
    return []
  }

  const advisorIds = (data || []).map((p) => p.user_id)

  if (IS_DEV) {
    console.debug('[getScopedAdvisorsForManager] advisors encontrados:', advisorIds.length)
  }

  return advisorIds
}

/**
 * Construir mapa de scores desde array de MetricScore
 */
export function buildScoresMap(scores: Array<{ metric_key: string; points_per_unit: number }>): Map<string, number> {
  const scoresMap = new Map<string, number>()
  scores.forEach((s) => {
    scoresMap.set(s.metric_key, s.points_per_unit)
  })
  return scoresMap
}

/**
 * Calcular rango de semana actual (lunes-domingo) en timezone Monterrey
 */
export function calcWeekRangeLocal(): { weekStartLocal: string; weekEndLocal: string; nextWeekStartLocal: string } {
  const todayStr = todayLocalYmd()
  const [y, m, d] = todayStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const jsDay = date.getDay() // 0=Domingo, 1=Lunes, ..., 6=Sábado
  const isoDay = jsDay === 0 ? 7 : jsDay // Convertir domingo de 0 a 7
  const mondayOffset = -(isoDay - 1) // Offset al lunes (0 si es lunes)
  
  const weekStartLocal = addDaysYmd(todayStr, mondayOffset)
  const weekEndLocal = addDaysYmd(weekStartLocal, 6) // Domingo
  const nextWeekStartLocal = addDaysYmd(weekStartLocal, 7) // Lunes siguiente
  
  return { weekStartLocal, weekEndLocal, nextWeekStartLocal }
}

/**
 * Calcular estadísticas semanales de un asesor
 */
export function computeAdvisorWeekStats(
  eventsWeek: Array<{ recorded_at: string; metric_key: string; value: number | null; actor_user_id: string }>,
  advisorId: string,
  scoresMap: Map<string, number>,
  weeklyTarget: number,
  weeklyDays: number,
  todayLocal: string,
  weekStartLocal: string,
  weekEndLocal: string
): AdvisorWeekStats | null {
  // Filtrar eventos del asesor
  const advisorEvents = eventsWeek.filter((e) => e.actor_user_id === advisorId)
  
  if (advisorEvents.length === 0) {
    return null
  }
  
  // Calcular puntos totales de la semana (todos los días)
  let weekPoints = 0
  const dailyPointsMap = new Map<string, number>() // day_local -> total_points
  
  advisorEvents.forEach((event) => {
    if (!event.recorded_at || !event.metric_key || !event.value) return
    
    const localDateStr = timestampToYmdInTz(event.recorded_at, TZ_MTY)
    
    // Verificar que esté dentro de la semana
    if (localDateStr < weekStartLocal || localDateStr > weekEndLocal) return
    
    const pointsPerUnit = scoresMap.get(event.metric_key) || 0
    const points = (event.value || 0) * pointsPerUnit
    
    weekPoints += points
    dailyPointsMap.set(localDateStr, (dailyPointsMap.get(localDateStr) || 0) + points)
  })
  
  // Calcular puntos hasta hoy (solo días con actividad hasta hoy)
  const daysUntilToday = Array.from(dailyPointsMap.entries()).filter(
    ([dayLocal]) => dayLocal <= todayLocal
  )
  const weekPointsUntilToday = daysUntilToday.reduce((sum, [, points]) => sum + points, 0)
  const daysWithActivity = daysUntilToday.length
  
  // Calcular ritmo y proyección
  let currentRhythm = 0
  let projection = 0
  
  if (daysWithActivity > 0) {
    currentRhythm = weekPointsUntilToday / daysWithActivity
    projection = currentRhythm * weeklyDays
  }
  
  // Calcular porcentaje y estado
  const percentOfTarget = weeklyTarget > 0 ? (weekPoints / weeklyTarget) * 100 : 0
  
  let status: 'excellent' | 'completed' | 'on_track' | 'at_risk'
  if (percentOfTarget >= 120) {
    status = 'excellent'
  } else if (percentOfTarget >= 100) {
    status = 'completed'
  } else if (projection >= weeklyTarget) {
    status = 'on_track'
  } else {
    status = 'at_risk'
  }
  
  return {
    advisor: { user_id: advisorId, full_name: null, display_name: null, role: 'advisor' }, // Se llenará después
    weekPoints,
    weekPointsUntilToday,
    daysWithActivity,
    currentRhythm,
    projection,
    percentOfTarget,
    status,
  }
}

/**
 * Calcular estadísticas históricas de 12 semanas de un asesor
 */
export function computeAdvisorHistoryStats(
  events12w: Array<{ recorded_at: string; metric_key: string; value: number | null; actor_user_id: string }>,
  advisorId: string,
  scoresMap: Map<string, number>,
  weeklyTarget: number
): AdvisorHistoryStats | null {
  // Filtrar eventos del asesor
  const advisorEvents = events12w.filter((e) => e.actor_user_id === advisorId)
  
  if (advisorEvents.length === 0) {
    return null
  }
  
  // Agrupar eventos por semana
  const weekTotals = groupEventsByWeek(advisorEvents, scoresMap)
  
  // Calcular métricas
  const weekPoints = Array.from(weekTotals.values())
  const weeksCompleted = weekPoints.filter((pts) => pts >= weeklyTarget).length
  const averagePoints = weekPoints.length > 0
    ? Math.round(weekPoints.reduce((sum, pts) => sum + pts, 0) / weekPoints.length)
    : 0
  const bestWeek = weekPoints.length > 0 ? Math.max(...weekPoints) : 0
  
  return {
    advisor: { user_id: advisorId, full_name: null, display_name: null, role: 'advisor' }, // Se llenará después
    weeksCompleted,
    averagePoints,
    bestWeek,
  }
}
