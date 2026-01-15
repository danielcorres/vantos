/**
 * Utilidades para manejo de fechas en timezone America/Monterrey
 * Todas las funciones trabajan con strings YYYY-MM-DD para evitar problemas de timezone
 */

export const TZ_MTY = 'America/Monterrey'

/**
 * Formatear fecha a YYYY-MM-DD en timezone especificado
 */
export function formatYmdInTz(date: Date, timeZone = TZ_MTY): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const y = parts.find((p) => p.type === 'year')!.value
  const m = parts.find((p) => p.type === 'month')!.value
  const d = parts.find((p) => p.type === 'day')!.value
  return `${y}-${m}-${d}` // YYYY-MM-DD
}

/**
 * Obtener fecha de hoy en formato YYYY-MM-DD en timezone Monterrey
 */
export function todayLocalYmd(): string {
  return formatYmdInTz(new Date(), TZ_MTY)
}

/**
 * Sumar o restar días a una fecha YYYY-MM-DD
 * @param ymd Fecha en formato YYYY-MM-DD
 * @param delta Número de días a sumar (positivo) o restar (negativo)
 * @returns Nueva fecha en formato YYYY-MM-DD
 */
export function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  // Crear fecha en timezone local del navegador (NO UTC)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + delta)
  
  // Formatear a YYYY-MM-DD
  const year = dt.getFullYear()
  const month = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Calcular diferencia de días entre dos fechas YYYY-MM-DD
 * @param ymd1 Fecha inicial (YYYY-MM-DD)
 * @param ymd2 Fecha final (YYYY-MM-DD)
 * @returns Número de días entre las fechas (puede ser negativo)
 */
export function daysBetweenYmd(ymd1: string, ymd2: string): number {
  const [y1, m1, d1] = ymd1.split('-').map(Number)
  const [y2, m2, d2] = ymd2.split('-').map(Number)
  
  // Crear fechas en timezone local del navegador (NO UTC)
  const date1 = new Date(y1, m1 - 1, d1)
  const date2 = new Date(y2, m2 - 1, d2)
  
  // Calcular diferencia en días
  const diffMs = date2.getTime() - date1.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  return diffDays
}

/**
 * Obtener fecha actual en timezone Monterrey como Date object
 * (Para casos donde se necesite un Date object, no un string)
 */
export function getTodayInMonterrey(): Date {
  const now = new Date()
  const monterreyTimeStr = now.toLocaleString('en-US', { timeZone: TZ_MTY })
  return new Date(monterreyTimeStr)
}

/**
 * Convertir timestamp a fecha YYYY-MM-DD en timezone Monterrey
 */
export function timestampToYmdInTz(timestamp: string | Date, timeZone = TZ_MTY): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  return formatYmdInTz(date, timeZone)
}
