/**
 * Helpers para calcular histórico semanal
 * Calcula semanas ISO (lunes-domingo) y agrupa eventos por semana
 */

import { addDaysYmd, timestampToYmdInTz, TZ_MTY, todayLocalYmd } from '../../../shared/utils/dates'

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
 * Calcular rango de semana (lunes-domingo) en timezone Monterrey
 * @param weekStartLocal Opcional: fecha YYYY-MM-DD del lunes de la semana. Si no se proporciona, usa la semana actual.
 */
export function calcWeekRangeLocal(weekStartLocal?: string): { weekStartLocal: string; weekEndLocal: string; nextWeekStartLocal: string } {
  let weekStart: string
  if (weekStartLocal) {
    // Validar que sea un lunes (opcional, pero útil para debugging)
    const [y, m, d] = weekStartLocal.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    const jsDay = date.getDay() // 0=Domingo, 1=Lunes, ..., 6=Sábado
    const isoDay = jsDay === 0 ? 7 : jsDay
    if (isoDay !== 1) {
      console.warn(`[calcWeekRangeLocal] weekStartLocal "${weekStartLocal}" no es un lunes (día ${isoDay}), pero se usará como está`)
    }
    weekStart = weekStartLocal
  } else {
    // Calcular semana actual
    const todayStr = todayLocalYmd()
    const [y, m, d] = todayStr.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    const jsDay = date.getDay() // 0=Domingo, 1=Lunes, ..., 6=Sábado
    const isoDay = jsDay === 0 ? 7 : jsDay // Convertir domingo de 0 a 7
    const mondayOffset = -(isoDay - 1) // Offset al lunes (0 si es lunes)
    weekStart = addDaysYmd(todayStr, mondayOffset)
  }
  
  const weekEndLocal = addDaysYmd(weekStart, 6) // Domingo
  const nextWeekStartLocal = addDaysYmd(weekStart, 7) // Lunes siguiente
  
  return { weekStartLocal: weekStart, weekEndLocal, nextWeekStartLocal }
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

/**
 * Formatear rango de semana de forma legible (ej. "26 ene 2026 – 1 feb 2026")
 * @param weekStartLocal Fecha de inicio de semana en formato YYYY-MM-DD
 * @param weekEndLocal Fecha de fin de semana en formato YYYY-MM-DD
 * @returns String formateado con ambas fechas completas
 */
export function formatWeekRangePretty(weekStartLocal: string, weekEndLocal: string): string {
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  
  const [startYear, startMonth, startDay] = weekStartLocal.split('-').map(Number)
  const [endYear, endMonth, endDay] = weekEndLocal.split('-').map(Number)
  
  const startMonthName = months[startMonth - 1]
  const endMonthName = months[endMonth - 1]
  
  return `${startDay} ${startMonthName} ${startYear} – ${endDay} ${endMonthName} ${endYear}`
}
