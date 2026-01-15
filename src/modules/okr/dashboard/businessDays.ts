/**
 * Helper para calcular días hábiles (lunes-viernes) en una semana
 */

/**
 * Parsear fecha YYYY-MM-DD a Date local (sin timezone conversion)
 */
function parseYmdLocal(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * Verificar si una fecha es día hábil (lunes-viernes)
 * 0=Domingo, 1=Lunes, ..., 6=Sábado
 */
function isWeekday(date: Date): boolean {
  const day = date.getDay()
  return day >= 1 && day <= 5 // Lunes (1) a Viernes (5)
}

/**
 * Calcular días hábiles transcurridos en la semana
 * @param weekStartLocal Fecha de inicio de semana (lunes) en formato YYYY-MM-DD
 * @param todayLocal Fecha de hoy en formato YYYY-MM-DD
 * @param weeklyDays Número total de días hábiles de la semana (típicamente 5)
 * @returns Número de días hábiles desde weekStartLocal hasta todayLocal (inclusivo), cap a weeklyDays
 */
export function businessDaysElapsedInWeek({
  weekStartLocal,
  todayLocal,
  weeklyDays,
}: {
  weekStartLocal: string
  todayLocal: string
  weeklyDays: number
}): number {
  const startDate = parseYmdLocal(weekStartLocal)
  const todayDate = parseYmdLocal(todayLocal)

  // Si today < start, retornar 0
  if (todayDate < startDate) {
    return 0
  }

  // Calcular diferencia en días
  const diffTime = todayDate.getTime() - startDate.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  // Contar días hábiles desde start hasta today (inclusivo)
  let businessDays = 0
  for (let i = 0; i <= diffDays; i++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(startDate.getDate() + i)
    if (isWeekday(currentDate)) {
      businessDays++
    }
  }

  // Cap a weeklyDays
  return Math.min(businessDays, weeklyDays)
}
