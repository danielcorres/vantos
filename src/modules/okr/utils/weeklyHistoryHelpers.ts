/**
 * Helpers para calcular histórico semanal
 * Calcula semanas ISO (lunes-domingo) y agrupa eventos por semana
 */

import { addDaysYmd, timestampToYmdInTz, TZ_MTY } from '../../../shared/utils/dates'

/**
 * Obtener el lunes (inicio de semana ISO) de una fecha YYYY-MM-DD
 */
function getWeekStartFromDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const jsDay = date.getDay() // 0=Domingo, 1=Lunes, ..., 6=Sábado
  const isoDay = jsDay === 0 ? 7 : jsDay // Convertir domingo de 0 a 7
  const mondayOffset = -(isoDay - 1) // Offset al lunes (0 si es lunes)
  return addDaysYmd(dateStr, mondayOffset)
}

/**
 * Obtener los lunes (inicio de semana ISO) de las últimas n semanas
 * @param todayLocal Fecha de hoy en formato YYYY-MM-DD (timezone Monterrey)
 * @param n Número de semanas (incluyendo la actual)
 * @returns Array de strings YYYY-MM-DD (lunes de cada semana), más reciente primero
 */
export function getLastNWeekStarts(todayLocal: string, n: number): string[] {
  const weekStarts: string[] = []
  const todayWeekStart = getWeekStartFromDate(todayLocal)
  
  for (let i = 0; i < n; i++) {
    const weekStart = addDaysYmd(todayWeekStart, -i * 7)
    weekStarts.push(weekStart)
  }
  
  return weekStarts
}

/**
 * Agrupar eventos por semana y calcular totales de puntos
 * @param events Array de eventos con recorded_at, metric_key, value
 * @param scoresMap Mapa de metric_key -> points_per_unit
 * @returns Mapa de weekStartLocal (YYYY-MM-DD) -> totalPoints
 */
export function groupEventsByWeek(
  events: Array<{ recorded_at: string; metric_key: string; value: number | null }>,
  scoresMap: Map<string, number>
): Map<string, number> {
  const weekTotals = new Map<string, number>()
  
  events.forEach((event) => {
    if (!event.recorded_at || !event.metric_key || !event.value) return
    
    // Convertir recorded_at a fecha local Monterrey (string YYYY-MM-DD)
    const localDateStr = timestampToYmdInTz(event.recorded_at, TZ_MTY)
    
    // Obtener lunes de esa semana
    const weekStart = getWeekStartFromDate(localDateStr)
    
    // Calcular puntos
    const pointsPerUnit = scoresMap.get(event.metric_key) || 0
    const points = (event.value || 0) * pointsPerUnit
    
    // Acumular puntos por semana
    weekTotals.set(weekStart, (weekTotals.get(weekStart) || 0) + points)
  })
  
  return weekTotals
}

/**
 * Formatear rango de semana para mostrar (ej. "12–18 ene 2026")
 */
export function formatWeekRange(weekStartStr: string): string {
  const weekEndStr = addDaysYmd(weekStartStr, 6) // Domingo
  
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
