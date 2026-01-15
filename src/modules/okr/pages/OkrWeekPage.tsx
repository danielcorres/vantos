import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '../../../lib/supabaseClient'
import { okrQueries } from '../data/okrQueries'
import { getWeeklyMotivationMessage } from '../utils/weeklyMotivationHelpers'
import { useAutoRefresh } from '../../../shared/hooks/useAutoRefresh'
import { todayLocalYmd, addDaysYmd, daysBetweenYmd, timestampToYmdInTz, TZ_MTY } from '../../../shared/utils/dates'
import { getWeeklyRhythmCoach } from '../utils/weeklyRhythmCoach'
import { WeeklyRhythmCoach } from '../components/WeeklyRhythmCoach'
import { getLastNWeekStarts, groupEventsByWeek, formatWeekRange as formatWeekRangeHistory } from '../utils/weeklyHistoryHelpers'

interface WeekMetricTotal {
  metric_key: string
  label: string
  sort_order: number | null
  total_value_week: number | null
  points_per_unit: number | null
  total_points_week: number | null
}

interface WeekDailySummary {
  day_local: string
  metric_key: string
  label: string
  sort_order: number | null
  total_value: number | null
  points_per_unit: number | null
  total_points: number | null
}

interface DayActivity {
  day_local: string
  total_points: number
  total_value: number
}

interface WeeklyHistoryItem {
  weekStart: string // YYYY-MM-DD (lunes)
  weekRange: string // "12–18 ene 2026"
  totalPoints: number
  percentOfTarget: number
  status: 'excellent' | 'completed' | 'incomplete' // >=120%, >=100%, <100%
}

/**
 * Helper ISO week: convertir Date.getDay() (0=Domingo, 1=Lunes...) a índice ISO (0=Lunes, 6=Domingo)
 * @param ymd Fecha en formato YYYY-MM-DD
 * @returns Índice ISO: 0=Lunes, 1=Martes, ..., 6=Domingo
 */
function getIsoDayIndexFromYmd(ymd: string): number {
  const [y, m, d] = ymd.split('-').map(Number)
  // Crear fecha en timezone local del navegador (NO UTC)
  const date = new Date(y, m - 1, d)
  const jsDay = date.getDay() // 0=Domingo, 1=Lunes, ..., 6=Sábado
  const isoDay = jsDay === 0 ? 7 : jsDay // Convertir domingo de 0 a 7
  return isoDay - 1 // 0=Lunes, 1=Martes, ..., 6=Domingo
}

/**
 * Calcular inicio de semana (lunes) en timezone America/Monterrey como string YYYY-MM-DD
 */
function getWeekStartLocalStr(weekOffset: number): string {
  // Obtener fecha actual en timezone Monterrey
  const todayStr = todayLocalYmd()
  
  // Obtener índice ISO del día (0=Lunes, 6=Domingo)
  const isoDayIndex = getIsoDayIndexFromYmd(todayStr)
  
  // Calcular offset al lunes (si es lunes=0, no retroceder; si es domingo=6, retroceder 6 días)
  const mondayOffset = -isoDayIndex
  
  // Aplicar weekOffset
  const totalOffset = mondayOffset + (weekOffset * 7)
  
  // Calcular lunes de la semana usando addDaysYmd
  return addDaysYmd(todayStr, totalOffset)
}

/**
 * Obtener fecha de fin de semana (domingo) como string YYYY-MM-DD
 */
function getWeekEndLocalStr(weekStartStr: string): string {
  return addDaysYmd(weekStartStr, 6)
}

/**
 * Formatear rango de fechas para mostrar en header
 */
function formatWeekRange(weekStartStr: string, weekEndStr: string): string {
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  
  const [startYear, startMonth, startDay] = weekStartStr.split('-').map(Number)
  const [endYear, endMonth, endDay] = weekEndStr.split('-').map(Number)
  
  const startMonthName = months[startMonth - 1]
  const endMonthName = months[endMonth - 1]
  
  if (startMonth === endMonth && startYear === endYear) {
    return `${startDay}–${endDay} ${startMonthName} ${startYear}`
  }
  return `${startDay} ${startMonthName} ${startYear} – ${endDay} ${endMonthName} ${endYear}`
}

export function OkrWeekPage() {
  // Helper: Blindaje numérico defensivo
  const safeNumber = (v: unknown): number => {
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'string') {
      const parsed = parseFloat(v)
      if (Number.isFinite(parsed)) return parsed
    }
    return 0
  }

  // Helper: Calcular porcentaje seguro (evita división por 0 y NaN)
  const safePercent = (current: number, target: number): number => {
    if (target <= 0) return 0
    const percent = (current / target) * 100
    return Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0
  }

  const [weekOffset, setWeekOffset] = useState(0) // 0 = semana actual, -1 = anterior, etc.
  const [metricTotals, setMetricTotals] = useState<WeekMetricTotal[]>([])
  const [dailySummary, setDailySummary] = useState<WeekDailySummary[]>([])
  const [totalPointsWeek, setTotalPointsWeek] = useState(0)
  const [dailyTarget, setDailyTarget] = useState<number>(25)
  const [weeklyDays, setWeeklyDays] = useState<number>(5)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'count' | 'points'>('count') // Toggle Cantidad/Puntos
  const [weeklyHistory, setWeeklyHistory] = useState<WeeklyHistoryItem[]>([])

  // Calcular fechas de semana seleccionada como strings YYYY-MM-DD (memoizado)
  const { weekStartLocal, weekEndLocal, weekDays } = useMemo(() => {
    const weekStartStr = getWeekStartLocalStr(weekOffset)
    const weekEndStr = getWeekEndLocalStr(weekStartStr)
    
    // Generar array de días de la semana (lunes a domingo) usando strings
    const days: { dateStr: string; label: string; isToday: boolean }[] = []
    const dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
    
    // Obtener fecha de hoy en timezone Monterrey para comparación
    const todayStr = todayLocalYmd()
    
    for (let i = 0; i < 7; i++) {
      const dateStr = addDaysYmd(weekStartStr, i)
      
      // Verificar si es hoy (solo para semana actual)
      const isToday = dateStr === todayStr && weekOffset === 0
      
      days.push({
        dateStr,
        label: dayLabels[i],
        isToday,
      })
    }
    
    return {
      weekStartLocal: weekStartStr,
      weekEndLocal: weekEndStr,
      weekDays: days,
    }
  }, [weekOffset])

  const load = useCallback(async () => {
    let isMounted = true
    
    setLoading(true)
    setError(null)
    try {
      // Obtener usuario actual
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('No hay usuario autenticado')
      }

      // Cargar settings global (para meta diaria y semanal)
      const settings = await okrQueries.getOkrSettingsGlobal()
      setDailyTarget(settings.daily_base_target)
      setWeeklyDays(settings.weekly_days)

      // Convertir strings YYYY-MM-DD a timestamps UTC para queries
      // weekStartLocal es lunes 00:00:00 en Monterrey
      // weekEndLocal es domingo, necesitamos hasta domingo 23:59:59
      const [startYear, startMonth, startDay] = weekStartLocal.split('-').map(Number)
      const [endYear, endMonth, endDay] = weekEndLocal.split('-').map(Number)
      
      // Crear timestamps en UTC (asumiendo que la fecha es en timezone Monterrey)
      // Para filtrar correctamente, usamos el inicio del lunes y el inicio del lunes siguiente
      const weekStartUTC = new Date(Date.UTC(startYear, startMonth - 1, startDay, 0, 0, 0))
      const weekEndUTC = new Date(Date.UTC(endYear, endMonth - 1, endDay + 1, 0, 0, 0)) // Lunes siguiente 00:00:00
      
      const weekStartISO = weekStartUTC.toISOString()
      const weekEndISO = weekEndUTC.toISOString()

      // Cargar métricas y scores globales
      const [metricDefsResult, scoresResult] = await Promise.all([
        supabase
          .from('metric_definitions')
          .select('key, label, sort_order')
          .eq('is_active', true)
          .not('key', 'like', 'pipeline.%')
          .order('sort_order'),
        okrQueries.getMetricScores(),
      ])

      if (metricDefsResult.error) throw metricDefsResult.error

      // Crear mapa de scores
      const scoresMap = new Map<string, number>()
      scoresResult.forEach((s) => {
        scoresMap.set(s.metric_key, s.points_per_unit)
      })

      // Cargar activity_events para la semana seleccionada
      const { data: events, error: eventsError } = await supabase
        .from('activity_events')
        .select('recorded_at, metric_key, value')
        .eq('actor_user_id', user.id)
        .eq('is_void', false)
        .eq('source', 'manual')
        .gte('recorded_at', weekStartISO)
        .lt('recorded_at', weekEndISO) // Usar < en lugar de <= para excluir el lunes siguiente
        .order('recorded_at', { ascending: true })

      if (eventsError) throw eventsError

      // Procesar eventos: agrupar por día local y métrica
      const dailyMap = new Map<string, Map<string, number>>() // day_local -> metric_key -> total_value
      const dailyPointsMap = new Map<string, number>() // day_local -> total_points

      events?.forEach((event) => {
        if (!event.recorded_at || !event.metric_key) return

        // Convertir recorded_at a fecha local Monterrey (string YYYY-MM-DD)
        const localDateStr = timestampToYmdInTz(event.recorded_at, TZ_MTY)

        // Verificar que esté dentro de la semana (comparar strings YYYY-MM-DD)
        if (localDateStr < weekStartLocal || localDateStr > weekEndLocal) return

        const metricKey = event.metric_key
        const value = safeNumber(event.value)
        const pointsPerUnit = scoresMap.get(metricKey) || 0
        const points = value * pointsPerUnit

        // Acumular valores
        if (!dailyMap.has(localDateStr)) {
          dailyMap.set(localDateStr, new Map())
        }
        const metricMap = dailyMap.get(localDateStr)!
        metricMap.set(metricKey, (metricMap.get(metricKey) || 0) + value)

        // Acumular puntos del día
        dailyPointsMap.set(localDateStr, (dailyPointsMap.get(localDateStr) || 0) + points)
      })

      // Construir dailySummary
      const summary: WeekDailySummary[] = []
      dailyMap.forEach((metricMap, dayLocal) => {
        metricMap.forEach((totalValue, metricKey) => {
          const metricDef = metricDefsResult.data?.find((m) => m.key === metricKey)
          if (!metricDef) return

          summary.push({
            day_local: dayLocal,
            metric_key: metricKey,
            label: metricDef.label,
            sort_order: metricDef.sort_order,
            total_value: totalValue,
            points_per_unit: scoresMap.get(metricKey) || 0,
            total_points: totalValue * (scoresMap.get(metricKey) || 0),
          })
        })
      })

      if (!isMounted) return

      setDailySummary(summary)

      // Construir metricTotals (agregar por métrica)
      const totalsMap = new Map<string, WeekMetricTotal>()
      metricDefsResult.data?.forEach((metricDef) => {
        const metricKey = metricDef.key
        let totalValue = 0
        let totalPoints = 0

        summary.forEach((item) => {
          if (item.metric_key === metricKey) {
            totalValue += safeNumber(item.total_value)
            totalPoints += safeNumber(item.total_points)
          }
        })

        totalsMap.set(metricKey, {
          metric_key: metricKey,
          label: metricDef.label,
          sort_order: metricDef.sort_order,
          total_value_week: totalValue,
          points_per_unit: scoresMap.get(metricKey) || 0,
          total_points_week: totalPoints,
        })
      })

      if (!isMounted) return

      setMetricTotals(Array.from(totalsMap.values()).sort((a, b) => {
        const orderA = safeNumber(a.sort_order)
        const orderB = safeNumber(b.sort_order)
        if (orderA !== orderB) return orderA - orderB
        return (a.metric_key || '').localeCompare(b.metric_key || '')
      }))

      // Calcular total de puntos semanal
      const weekTotalPoints = Array.from(dailyPointsMap.values()).reduce((sum, pts) => sum + pts, 0)
      
      if (!isMounted) return
      
      setTotalPointsWeek(weekTotalPoints)

      // Cargar histórico de últimas 12 semanas
      const todayStr = todayLocalYmd()
      const weekStarts = getLastNWeekStarts(todayStr, 12)
      
      // Obtener rango de fechas: desde lunes de hace 11 semanas hasta lunes siguiente a la semana actual
      const oldestWeekStart = weekStarts[weekStarts.length - 1] // Semana más antigua
      const currentWeekStart = weekStarts[0] // Semana actual
      const nextWeekStart = addDaysYmd(currentWeekStart, 7) // Lunes siguiente
      
      // Convertir a timestamps UTC para query
      const [oldestYear, oldestMonth, oldestDay] = oldestWeekStart.split('-').map(Number)
      const [nextYear, nextMonth, nextDay] = nextWeekStart.split('-').map(Number)
      
      const oldestUTC = new Date(Date.UTC(oldestYear, oldestMonth - 1, oldestDay, 0, 0, 0))
      const nextUTC = new Date(Date.UTC(nextYear, nextMonth - 1, nextDay, 0, 0, 0))
      
      // Query de eventos
      const { data: historyEvents, error: historyError } = await supabase
        .from('activity_events')
        .select('recorded_at, metric_key, value')
        .eq('actor_user_id', user.id)
        .eq('is_void', false)
        .eq('source', 'manual')
        .gte('recorded_at', oldestUTC.toISOString())
        .lt('recorded_at', nextUTC.toISOString())
        .order('recorded_at', { ascending: true })
      
      if (historyError) {
        console.warn('Error al cargar histórico:', historyError)
        setWeeklyHistory([])
      } else {
        // Agrupar eventos por semana
        const weekTotals = groupEventsByWeek(historyEvents || [], scoresMap)
        
        // Calcular meta semanal
        const weeklyTarget = settings.daily_base_target * settings.weekly_days
        
        // Construir array de histórico
        const history: WeeklyHistoryItem[] = weekStarts.map((weekStart) => {
          const totalPoints = weekTotals.get(weekStart) || 0
          const percentOfTarget = weeklyTarget > 0 ? (totalPoints / weeklyTarget) * 100 : 0
          
          let status: 'excellent' | 'completed' | 'incomplete'
          if (percentOfTarget >= 120) {
            status = 'excellent'
          } else if (percentOfTarget >= 100) {
            status = 'completed'
          } else {
            status = 'incomplete'
          }
          
          return {
            weekStart,
            weekRange: formatWeekRangeHistory(weekStart),
            totalPoints,
            percentOfTarget,
            status,
          }
        })
        
        if (isMounted) {
          setWeeklyHistory(history)
        }
      }
    } catch (err: unknown) {
      if (isMounted) {
        const errorMessage = err instanceof Error ? err.message : 'Error al cargar datos'
        setError(errorMessage)
      }
    } finally {
      if (isMounted) {
        setLoading(false)
      }
    }
  }, [weekStartLocal, weekEndLocal])

  useEffect(() => {
    load()
  }, [load])

  // Auto-refresh solo para semana actual
  useAutoRefresh(load, { enabled: !loading && weekOffset === 0 })

  // Crear mapa: metric_key -> day_local -> total_value (memoizado)
  const dailyMap = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    dailySummary.forEach((item) => {
      if (!item.metric_key || !item.day_local) return
      if (!map.has(item.metric_key)) {
        map.set(item.metric_key, new Map())
      }
      map.get(item.metric_key)!.set(item.day_local, safeNumber(item.total_value))
    })
    return map
  }, [dailySummary])

  // Crear mapa de puntos: metric_key -> day_local -> total_points (memoizado)
  const dailyPointsMap = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    dailySummary.forEach((item) => {
      if (!item.metric_key || !item.day_local) return
      if (!map.has(item.metric_key)) {
        map.set(item.metric_key, new Map())
      }
      map.get(item.metric_key)!.set(item.day_local, safeNumber(item.total_points))
    })
    return map
  }, [dailySummary])

  // Función para obtener el valor de una métrica en un día específico
  // dayStr es el dateStr de weekDays (YYYY-MM-DD), que debe coincidir con day_local de dailySummary
  const getValueForDay = (metricKey: string, dayStr: string): number => {
    // Verificar que dayStr esté dentro del rango de la semana
    const dayIndex = daysBetweenYmd(weekStartLocal, dayStr)
    if (dayIndex < 0 || dayIndex > 6) return 0
    
    // Buscar directamente en el mapa usando dayStr (que es el day_local de los eventos)
    // dayStr ya es YYYY-MM-DD en timezone Monterrey, igual que day_local en dailySummary
    if (viewMode === 'points') {
      return safeNumber(dailyPointsMap.get(metricKey)?.get(dayStr))
    }
    return safeNumber(dailyMap.get(metricKey)?.get(dayStr))
  }

  // Calcular días con actividad (para highlights)
  const daysWithActivity = useMemo(() => {
    const days = new Set<string>()
    dailySummary.forEach((item) => {
      if (item.day_local && (safeNumber(item.total_value) > 0 || safeNumber(item.total_points) > 0)) {
        days.add(item.day_local)
      }
    })
    return days
  }, [dailySummary])

  // Calcular actividad por día (para resumen)
  const dayActivities = useMemo((): DayActivity[] => {
    const activities = new Map<string, DayActivity>()
    
    dailySummary.forEach((item) => {
      if (!item.day_local) return
      const existing = activities.get(item.day_local) || { day_local: item.day_local, total_points: 0, total_value: 0 }
      existing.total_points += safeNumber(item.total_points)
      existing.total_value += safeNumber(item.total_value)
      activities.set(item.day_local, existing)
    })

    return Array.from(activities.values()).sort((a, b) => a.day_local.localeCompare(b.day_local))
  }, [dailySummary])

  // Calcular resumen semanal (memoizado)
  const weeklySummary = useMemo(() => {
    const safeDailyTarget = safeNumber(dailyTarget)
    const safeWeeklyDays = safeNumber(weeklyDays)
    const safeTotalPoints = safeNumber(totalPointsWeek)
    const weeklyTarget = safeDailyTarget * safeWeeklyDays

    // Días cumplidos (puntos >= daily_expected_points)
    const daysCompleted = dayActivities.filter((day) => day.total_points >= safeDailyTarget).length

    // Mejor día (más puntos)
    const bestDay = dayActivities.length > 0
      ? dayActivities.reduce((best, day) => (day.total_points > best.total_points ? day : best), dayActivities[0])
      : null

    // Faltan puntos
    const pointsRemaining = Math.max(0, weeklyTarget - safeTotalPoints)

    // Formatear mejor día usando diferencia de días
    let bestDayLabel = '—'
    if (bestDay && bestDay.total_points > 0) {
      const dayIndex = daysBetweenYmd(weekStartLocal, bestDay.day_local)
      if (dayIndex >= 0 && dayIndex <= 6) {
        const dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
        bestDayLabel = `${dayLabels[dayIndex]} (${Math.round(bestDay.total_points)} pts)`
      }
    }

    return {
      daysCompleted,
      bestDayLabel,
      pointsRemaining,
      weeklyTarget,
    }
  }, [dayActivities, dailyTarget, weeklyDays, totalPointsWeek, weekStartLocal])

  // Calcular meta y progreso semanal con blindaje
  const safeDailyTarget = safeNumber(dailyTarget)
  const safeWeeklyDays = safeNumber(weeklyDays)
  const safeTotalPoints = safeNumber(totalPointsWeek)
  const weeklyTarget = safeDailyTarget * safeWeeklyDays
  const weeklyProgress: number = safePercent(safeTotalPoints, weeklyTarget)
  const weeklyMotivation = getWeeklyMotivationMessage(weeklyProgress)

  // Ritmo semanal predictivo: calcular proyección basada en ritmo actual
  // Calcula ritmo_actual = puntos_hasta_hoy / días_con_registro y proyecta al final de la semana
  const rhythmCoach = useMemo(() => {
    const todayStr = todayLocalYmd()
    
    // Filtrar solo días hasta hoy (no futuros) y calcular puntos acumulados hasta hoy
    const daysUntilToday = dayActivities.filter(
      (day) => day.day_local <= todayStr && day.total_points > 0
    )
    const currentWeekPointsUntilToday = daysUntilToday.reduce(
      (sum, day) => sum + day.total_points,
      0
    )
    
    return getWeeklyRhythmCoach({
      dayActivities: dayActivities.map((d) => ({
        day_local: d.day_local,
        total_points: d.total_points,
        total_value: d.total_value,
      })),
      todayLocal: todayStr,
      weeklyDays: safeWeeklyDays,
      weeklyTarget,
      currentWeekPoints: currentWeekPointsUntilToday,
    })
  }, [dayActivities, safeWeeklyDays, weeklyTarget])

  // Función para obtener color de barra semanal
  const getWeeklyBarColor = () => {
    if (weeklyProgress >= 120) return '#9333ea' // purple
    if (weeklyProgress >= 100) return '#22c55e' // green
    if (weeklyProgress >= 80) return '#eab308' // yellow
    return '#f97316' // orange
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <div className="h-8 w-48 bg-bg rounded mb-2 animate-pulse" />
          <div className="h-4 w-32 bg-bg rounded animate-pulse" />
        </div>
        <div className="card p-4">
          <div className="h-32 bg-bg rounded animate-pulse" />
        </div>
        <div className="card p-0">
          <div className="h-64 bg-bg rounded animate-pulse" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header con navegación de semanas */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold">OKR Semana</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekOffset((prev) => prev - 1)}
              className="btn btn-ghost btn-sm px-3"
              disabled={loading}
            >
              ← Semana anterior
            </button>
            <button
              onClick={() => setWeekOffset(0)}
              className="btn btn-ghost btn-sm px-3"
              disabled={weekOffset === 0 || loading}
            >
              Esta semana
            </button>
            <button
              onClick={() => setWeekOffset((prev) => Math.min(0, prev + 1))}
              className="btn btn-ghost btn-sm px-3"
              disabled={weekOffset === 0 || loading}
            >
              Semana siguiente →
            </button>
          </div>
        </div>
        <p className="text-sm text-muted">
          Semana del {formatWeekRange(weekStartLocal, weekEndLocal)}
        </p>
      </div>

      {/* Summary Card */}
      <div className="card p-4">
        {safeTotalPoints === 0 && weeklyTarget > 0 ? (
          <div className="text-center py-4">
            <div className="text-sm text-muted mb-2">Empieza registrando tu actividad esta semana</div>
            <div className="text-xs text-muted">Meta semanal: {weeklySummary.weeklyTarget} pts</div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold mb-1">Progreso semanal</div>
                <div className="flex items-center gap-2">
                  <div className="text-2xl font-black">{safeTotalPoints} / {weeklySummary.weeklyTarget} pts</div>
                  {weeklyProgress >= 100 && <span className="text-lg">✅</span>}
                  {weeklyProgress >= 120 && <span className="text-lg">🔥</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted mb-1">Meta semanal</div>
                <div className="text-lg font-semibold">{weeklySummary.weeklyTarget} pts</div>
              </div>
            </div>

            {/* Barra de progreso semanal */}
            <div className="relative h-10 bg-bg rounded-lg overflow-hidden mb-3 shadow-inner">
              <div
                className="absolute left-0 top-0 h-full transition-all duration-500 ease-out"
                style={{
                  width: `${weeklyProgress}%`,
                  background: getWeeklyBarColor(),
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-text">
                {weeklyProgress >= 100 ? (
                  <span className="flex items-center gap-1.5">
                    <span>✓</span>
                    <span>Semana cumplida</span>
                  </span>
                ) : (
                  <span>
                    {Math.round(weeklyProgress)}% • Faltan {weeklySummary.pointsRemaining} pts para la meta
                  </span>
                )}
              </div>
            </div>

            {/* Ritmo semanal predictivo */}
            <WeeklyRhythmCoach coach={rhythmCoach} />

            {/* Resumen semanal (chips) */}
            <div className="flex flex-wrap gap-3 mb-3">
              <div className="px-3 py-1.5 bg-bg rounded-lg text-sm">
                <span className="text-muted">Días cumplidos: </span>
                <span className="font-semibold">{weeklySummary.daysCompleted} / {safeWeeklyDays}</span>
              </div>
              <div className="px-3 py-1.5 bg-bg rounded-lg text-sm">
                <span className="text-muted">Mejor día: </span>
                <span className="font-semibold">{weeklySummary.bestDayLabel}</span>
              </div>
              <div className="px-3 py-1.5 bg-bg rounded-lg text-sm">
                <span className="text-muted">Faltan: </span>
                <span className="font-semibold">{weeklySummary.pointsRemaining} pts</span>
              </div>
            </div>

            {/* Mensaje motivacional semanal */}
            <div className={`text-sm font-medium mb-2 ${weeklyMotivation.color}`}>
              {weeklyMotivation.icon && <span className="mr-1">{weeklyMotivation.icon}</span>}
              {weeklyMotivation.message}
            </div>
          </>
        )}

        {/* Info adicional */}
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            Meta diaria: {safeDailyTarget} pts × {safeWeeklyDays} días = {weeklySummary.weeklyTarget} pts
          </span>
          <button onClick={load} className="btn btn-ghost text-xs px-2 py-1" disabled={loading}>
            Actualizar
          </button>
        </div>
      </div>

      {error && (
        <div className="card p-4 bg-red-50 border border-red-200">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* Toggle Cantidad/Puntos */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <h2 className="text-lg font-semibold">Actividad semanal</h2>
        <div className="flex items-center gap-2">
          <div className="flex bg-bg rounded-lg p-1 border border-border">
            <button
              onClick={() => setViewMode('count')}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                viewMode === 'count'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted hover:text-text'
              }`}
            >
              Cantidad
            </button>
            <button
              onClick={() => setViewMode('points')}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                viewMode === 'points'
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-muted hover:text-text'
              }`}
            >
              Puntos
            </button>
          </div>
        </div>
      </div>

      {/* Tabla semanal */}
      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-400px)] overflow-y-auto">
          <table className="w-full">
            <thead className="bg-bg sticky top-0 z-10 border-b-2 border-border">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wide">
                  Actividad
                </th>
                {weekDays.map((day) => (
                  <th
                    key={day.dateStr}
                    className={`text-center py-3 px-2 text-xs font-semibold text-muted uppercase tracking-wide ${
                      day.isToday ? 'border-l-2 border-r-2 border-primary' : ''
                    } ${
                      daysWithActivity.has(day.dateStr) ? 'bg-primary/5' : ''
                    }`}
                  >
                    {day.label}
                    {day.isToday && <span className="ml-1 text-primary">●</span>}
                  </th>
                ))}
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase tracking-wide">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {metricTotals.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center py-12 px-4 text-muted"
                  >
                    <div className="mb-2">No hay actividad esta semana</div>
                    <div className="text-xs">
                      Empieza a registrar tu actividad diaria para ver el resumen aquí
                    </div>
                  </td>
                </tr>
              ) : (
                metricTotals.map((metric, index) => {
                  const rowTotal = viewMode === 'points'
                    ? safeNumber(metric.total_points_week)
                    : safeNumber(metric.total_value_week)
                  
                  return (
                    <tr
                      key={metric.metric_key}
                      className={`border-b border-border transition-colors ${
                        index % 2 === 0 ? 'bg-surface' : 'bg-bg'
                      } hover:bg-primary/5`}
                    >
                      <td className="py-2.5 px-4 font-medium text-sm">
                        {metric.label || metric.metric_key || 'Sin nombre'}
                      </td>
                      {weekDays.map((day) => {
                        const value = getValueForDay(metric.metric_key, day.dateStr)
                        const hasActivity = value > 0
                        return (
                          <td
                            key={day.dateStr}
                            className={`py-2.5 px-2 text-center text-sm ${
                              hasActivity ? 'bg-primary/10 font-medium' : ''
                            } ${
                              day.isToday ? 'border-l border-r border-primary/30' : ''
                            }`}
                          >
                            {value > 0 ? value : '—'}
                          </td>
                        )
                      })}
                      <td className="py-2.5 px-4 text-right font-bold text-sm">
                        {rowTotal > 0 ? rowTotal : '—'}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Histórico de últimas 12 semanas */}
      {weeklyHistory.length > 0 && (
        <div className="card p-4">
          <h2 className="text-lg font-semibold mb-3">Últimas 12 semanas</h2>
          
          {/* Insights */}
          {(() => {
            const completedWeeks = weeklyHistory.filter((w) => w.status === 'completed' || w.status === 'excellent').length
            const totalPoints = weeklyHistory.reduce((sum, w) => sum + w.totalPoints, 0)
            const avgPoints = Math.round(totalPoints / weeklyHistory.length)
            const bestWeek = weeklyHistory.reduce((best, w) => w.totalPoints > best.totalPoints ? w : best, weeklyHistory[0])
            
            return (
              <div className="flex flex-wrap gap-4 mb-4 text-sm">
                <div>
                  <span className="text-muted">Cumpliste: </span>
                  <span className="font-semibold">{completedWeeks} de {weeklyHistory.length} semanas</span>
                </div>
                <div>
                  <span className="text-muted">Promedio semanal: </span>
                  <span className="font-semibold">{avgPoints} pts</span>
                </div>
                <div>
                  <span className="text-muted">Mejor semana: </span>
                  <span className="font-semibold">{bestWeek.totalPoints} pts</span>
                </div>
              </div>
            )
          })()}
          
          {/* Tabla compacta */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-muted uppercase">Semana</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-muted uppercase">Puntos</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-muted uppercase">% Meta</th>
                  <th className="text-center py-2 px-2 text-xs font-semibold text-muted uppercase">Estado</th>
                </tr>
              </thead>
              <tbody>
                {weeklyHistory.map((item) => {
                  const getBarColor = () => {
                    if (item.percentOfTarget >= 120) return '#9333ea' // purple
                    if (item.percentOfTarget >= 100) return '#22c55e' // green
                    if (item.percentOfTarget >= 80) return '#eab308' // yellow
                    return '#94a3b8' // gray
                  }
                  
                  return (
                    <tr key={item.weekStart} className="border-b border-border hover:bg-bg">
                      <td className="py-2 px-2 text-text">{item.weekRange}</td>
                      <td className="py-2 px-2 text-right font-medium">{Math.round(item.totalPoints)}</td>
                      <td className="py-2 px-2">
                        <div className="flex items-center justify-end gap-2">
                          <div className="flex-1 max-w-[100px]">
                            <div className="h-2 bg-bg rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.min(item.percentOfTarget, 100)}%`,
                                  background: getBarColor(),
                                }}
                              />
                            </div>
                          </div>
                          <span className="text-xs text-muted w-12 text-right">
                            {Math.round(item.percentOfTarget)}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-center">
                        {item.status === 'excellent' && <span>🔥</span>}
                        {item.status === 'completed' && <span>✅</span>}
                        {item.status === 'incomplete' && <span className="text-muted">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
