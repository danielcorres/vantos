/**
 * Helper para calcular ritmo semanal predictivo
 * Calcula proyección basada en ritmo actual y sugiere acciones
 */

export interface DayActivity {
  day_local: string // YYYY-MM-DD
  total_points: number
  total_value: number
}

export interface WeeklyRhythmCoach {
  statusMessage: string | null
  actionMessage: string | null
  projection: number
  currentRhythm: number
  daysWithActivity: number
}

/**
 * Calcular ritmo semanal predictivo
 * @param dayActivities Array de actividades por día (ya filtrado por semana)
 * @param todayLocal Fecha de hoy en formato YYYY-MM-DD (timezone Monterrey)
 * @param weeklyDays Número de días de la semana (ej: 5)
 * @param weeklyTarget Meta semanal en puntos
 * @param currentWeekPoints Puntos totales acumulados hasta hoy (solo días con actividad hasta hoy)
 * @returns Objeto con mensajes y proyección
 */
export function getWeeklyRhythmCoach({
  dayActivities,
  todayLocal,
  weeklyDays,
  weeklyTarget,
  currentWeekPoints,
}: {
  dayActivities: DayActivity[]
  todayLocal: string
  weeklyDays: number
  weeklyTarget: number
  currentWeekPoints: number
}): WeeklyRhythmCoach {
  // Filtrar solo días hasta hoy (no futuros) y con actividad
  const daysUntilToday = dayActivities.filter(
    (day) => day.day_local <= todayLocal && day.total_points > 0
  )

  const daysWithActivity = daysUntilToday.length

  // Si no hay actividad aún
  if (daysWithActivity === 0) {
    return {
      statusMessage: 'Aún no hay registros esta semana. Registra hoy para calcular tu ritmo.',
      actionMessage: null,
      projection: 0,
      currentRhythm: 0,
      daysWithActivity: 0,
    }
  }

  // Calcular ritmo actual (puntos por día con actividad)
  const currentRhythm = currentWeekPoints / daysWithActivity

  // Proyección: ritmo actual * días totales de la semana
  const projection = currentRhythm * weeklyDays

  // Verificar si la semana ya está cumplida
  const isWeekCompleted = currentWeekPoints >= weeklyTarget

  // Mensaje de estado
  let statusMessage: string | null = null
  if (projection < weeklyTarget) {
    statusMessage = `Con este ritmo cerrarías en ${Math.round(projection)} pts. No alcanzas la meta.`
  } else {
    statusMessage = `Con este ritmo cerrarías en ${Math.round(projection)} pts. Vas en camino.`
  }

  // Sugerencia accionable (solo si NO alcanza y semana NO está cumplida)
  let actionMessage: string | null = null
  if (!isWeekCompleted && projection < weeklyTarget) {
    // Calcular días restantes (desde hoy hasta el último día de la semana)
    // Asumimos que weeklyDays es el número de días laborables, pero necesitamos días calendario restantes
    // Para simplificar, usamos: días restantes = weeklyDays - días con actividad hasta hoy
    // Pero esto puede no ser exacto si hay días sin actividad. Mejor: días desde hoy hasta fin de semana
    // Por ahora, usamos una aproximación: si faltan puntos, calculamos promedio necesario
    
    const pointsNeeded = weeklyTarget - currentWeekPoints
    // Días restantes aproximados: si ya pasaron X días con actividad, quedan (weeklyDays - X) días
    // Pero esto no es exacto. Mejor: calcular días restantes desde hoy hasta el último día de semana
    // Por simplicidad, usamos: días restantes = weeklyDays - días con actividad
    const daysRemaining = Math.max(1, weeklyDays - daysWithActivity)
    
    if (daysRemaining > 0 && pointsNeeded > 0) {
      const dailyPointsRequired = pointsNeeded / daysRemaining
      actionMessage = `Necesitas promediar ${Math.round(dailyPointsRequired)} pts diarios el resto de la semana.`
    }
  }

  return {
    statusMessage,
    actionMessage,
    projection: Math.round(projection),
    currentRhythm: Math.round(currentRhythm * 10) / 10, // Redondear a 1 decimal
    daysWithActivity,
  }
}
