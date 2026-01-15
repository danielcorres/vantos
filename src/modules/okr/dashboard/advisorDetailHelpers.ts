/**
 * Helpers para construir los bloques de detalle semanal del asesor
 * - Desglose por métrica
 * - Línea de tiempo día a día (7 días: lunes-domingo)
 * - Plan para cumplir (multi-día)
 */

import { timestampToYmdInTz } from '../../../shared/utils/dates'
import { buildTodayPlanForAdvisor } from './todayActionPlan'
import type { RiskReason } from './teamDashboardInsights'
import { getMetricLabel } from '../domain/metricLabels'

const TIMEZONE = 'America/Monterrey'

/**
 * Helper TZ-safe: sumar días a una fecha YYYY-MM-DD usando Date.UTC
 * Retorna ymd (string) y dateUTC (Date) para uso consistente
 */
function addDaysYmd(ymd: string, days: number): { ymd: string; dateUTC: Date } {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return { ymd: `${yy}-${mm}-${dd}`, dateUTC: dt }
}

/**
 * Obtener nombre corto de día de la semana (TZ-safe usando UTC)
 */
function getDayNameShort(date: Date): string {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  return days[date.getUTCDay()]
}

/**
 * BLOQUE 1: Desglose por métrica (semana completa)
 */
export interface MetricBreakdownRow {
  metric_key: string
  metric_label: string
  units: number
  points: number
  percentOfTotal: number
  pointsPerUnit: number | null
}

export function buildMetricBreakdown(
  events: Array<{ metric_key: string; value: number }>,
  scoresMap: Map<string, number>
): MetricBreakdownRow[] {
  // Agrupar por métrica y sumar unidades
  const metricMap = new Map<string, number>()
  events.forEach((event) => {
    const current = metricMap.get(event.metric_key) || 0
    metricMap.set(event.metric_key, current + event.value)
  })

  // Calcular puntos y porcentaje
  const rows: MetricBreakdownRow[] = []
  let totalPoints = 0

  metricMap.forEach((units, metricKey) => {
    const pointsPerUnit = scoresMap.get(metricKey) || null
    const points = pointsPerUnit ? units * pointsPerUnit : 0
    totalPoints += points

    rows.push({
      metric_key: metricKey,
      metric_label: getMetricLabel(metricKey),
      units,
      points,
      percentOfTotal: 0, // Se calculará después
      pointsPerUnit,
    })
  })

  // Calcular porcentajes
  rows.forEach((row) => {
    row.percentOfTotal = totalPoints > 0 ? (row.points / totalPoints) * 100 : 0
  })

  // Ordenar por puntos desc
  rows.sort((a, b) => b.points - a.points)

  return rows
}

/**
 * BLOQUE 2: Línea de tiempo día a día (7 días: lunes-domingo)
 */
export interface DailyTimelineRow {
  dayLabel: string // "Lun 12"
  dateYmd: string // "2026-01-12"
  points: number
  activity: string // "9 Llamadas · 2 Citas agendadas · 1 Propuestas presentadas"
  status: string // "0 pts" o "Activo"
}

export function buildDailyTimeline(
  events: Array<{ recorded_at: string; metric_key: string; value: number }>,
  scoresMap: Map<string, number>,
  weekStartLocal: string
): DailyTimelineRow[] {
  // Crear 7 días (lunes a domingo) usando addDaysYmd TZ-safe
  const rows: DailyTimelineRow[] = []
  for (let i = 0; i < 7; i++) {
    const { ymd: dateYmd, dateUTC } = addDaysYmd(weekStartLocal, i)
    const dayLabel = `${getDayNameShort(dateUTC)} ${dateUTC.getUTCDate()}`

    rows.push({
      dayLabel,
      dateYmd,
      points: 0,
      activity: '',
      status: '0 pts',
    })
  }

  // Agrupar eventos por día local (America/Monterrey)
  const eventsByDay = new Map<string, Array<{ metric_key: string; value: number }>>()
  events.forEach((event) => {
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
      row.activity = ''
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

    // Construir actividad compacta (top 3 métricas por unidades)
    const metricArray = Array.from(metricMap.entries())
      .map(([key, units]) => ({ key, units }))
      .sort((a, b) => b.units - a.units)
      .slice(0, 3)

    const activityParts = metricArray.map(({ key, units }) => {
      const label = getMetricLabel(key)
      return `${units} ${label}`
    })

    row.activity = activityParts.join(' · ')
    row.status = dayPoints > 0 ? 'Activo' : '0 pts'
  })

  return rows
}

/**
 * BLOQUE 3: Plan para cumplir (multi-día)
 */
export interface FulfillmentPlanRow {
  dayLabel: string // "Hoy", "Mañana", "Lun 13", etc.
  dateYmd: string
  requiredDailyAvg: number
  planLabel: string // Label del todayActionPlan
}

export interface FulfillmentPlan {
  rows: FulfillmentPlanRow[]
  tomorrowRequired: number | null // Si cumple hoy, mañana requiere X pts/día
}

export function buildFulfillmentPlan({
  pointsRemaining,
  daysRemaining,
  riskReason,
  scoresMap,
  todayLocal,
  weekEndLocal,
}: {
  pointsRemaining: number
  daysRemaining: number
  riskReason: RiskReason
  scoresMap: Map<string, number>
  todayLocal: string
  weekEndLocal: string
}): FulfillmentPlan {
  const rows: FulfillmentPlanRow[] = []

  // Si no hay días restantes o puntos restantes, mostrar "Mantener"
  if (daysRemaining === 0 || pointsRemaining === 0) {
    return {
      rows: [
        {
          dayLabel: 'Hoy',
          dateYmd: todayLocal,
          requiredDailyAvg: 0,
          planLabel: '✅ Mantener',
        },
      ],
      tomorrowRequired: null,
    }
  }

  // Generar plan para cada día desde hoy hasta domingo (inclusivo) usando offsets TZ-safe
  let currentPointsRemaining = pointsRemaining
  let currentDaysRemaining = daysRemaining
  let dayIndex = 0

  while (currentDaysRemaining > 0) {
    const { ymd, dateUTC } = addDaysYmd(todayLocal, dayIndex)
    
    // Si ymd > weekEndLocal (comparación string), salir
    if (ymd > weekEndLocal) {
      break
    }

    // Calcular requiredDailyAvg para este día
    const dayRequired = currentDaysRemaining > 0 
      ? Math.ceil(currentPointsRemaining / currentDaysRemaining)
      : currentPointsRemaining

    // Generar plan usando todayActionPlan
    const todayPlan = buildTodayPlanForAdvisor({
      requiredDailyAvg: dayRequired,
      riskReason: dayIndex === 0 ? riskReason : 'on_track', // Solo el primer día usa el riskReason original
      scoresMap,
    })

    // Label del día
    let dayLabel: string
    if (dayIndex === 0) {
      dayLabel = 'Hoy'
    } else if (dayIndex === 1) {
      dayLabel = 'Mañana'
    } else {
      dayLabel = `${getDayNameShort(dateUTC)} ${dateUTC.getUTCDate()}`
    }

    rows.push({
      dayLabel,
      dateYmd: ymd,
      requiredDailyAvg: dayRequired,
      planLabel: todayPlan.label,
    })

    // Simular cumplimiento: actualizar puntos y días restantes
    currentPointsRemaining = Math.max(currentPointsRemaining - dayRequired, 0)
    currentDaysRemaining = Math.max(currentDaysRemaining - 1, 0)

    // Avanzar al siguiente día
    dayIndex++
  }

  // Calcular tomorrowRequired (si cumple hoy)
  const firstDayRequired = rows[0]?.requiredDailyAvg || 0
  const simulatedPointsRemaining = Math.max(pointsRemaining - firstDayRequired, 0)
  const simulatedDaysRemaining = Math.max(daysRemaining - 1, 0)
  const calculatedTomorrowRequired = simulatedDaysRemaining > 0
    ? Math.ceil(simulatedPointsRemaining / simulatedDaysRemaining)
    : simulatedPointsRemaining > 0
    ? simulatedPointsRemaining
    : null

  return {
    rows,
    tomorrowRequired: calculatedTomorrowRequired,
  }
}
