/**
 * Dominio Pipeline: reglas de Próximo paso en un solo lugar.
 * Los componentes no reimplementan estas reglas.
 */

import { daysOverdue } from '../../../shared/utils/nextAction'
import {
  TZ,
  toYmdInMonterrey,
  getTodayYmd,
} from '../../../shared/utils/nextAction'

export type NextActionType = 'contact' | 'meeting'

export interface LeadLike {
  next_action_at?: string | null
  next_action_type?: string | null
}

/**
 * Tipo normalizado del próximo paso: solo 'contact' | 'meeting' | null.
 * Legacy (call, follow_up, presentation) se considera eliminado a nivel de DB.
 */
export function getNextActionType(lead: LeadLike): NextActionType | null {
  const t = (lead.next_action_type ?? '').trim().toLowerCase()
  if (!t) return null
  if (t === 'contact' || t === 'meeting') return t
  if (t === 'call' || t === 'follow_up') return 'contact'
  if (t === 'presentation') return 'meeting'
  return 'contact'
}

/**
 * true si next_action_at está vencido >= 7 días (America/Monterrey).
 */
export function isOverdueSevenDays(
  lead: LeadLike,
  now: Date = new Date()
): boolean {
  return daysOverdue(lead.next_action_at, now) >= 7
}

/** Suma n días a YYYY-MM-DD. */
function addDaysToYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if ([y, m, d].some(Number.isNaN) || !Number.isFinite(n)) return ymd
  const next = new Date(Date.UTC(y, m - 1, d + n))
  if (isNaN(next.getTime())) return ymd
  const y2 = next.getUTCFullYear()
  const m2 = String(next.getUTCMonth() + 1).padStart(2, '0')
  const d2 = String(next.getUTCDate()).padStart(2, '0')
  return `${y2}-${m2}-${d2}`
}

/**
 * Etiqueta de fecha para próximo paso (es-MX, America/Monterrey).
 * - Hoy: "Hoy · 9:00 a. m."
 * - Mañana: "Mañana · 11:00 a. m."
 * - Otro día: "Vie 27 mar · 6:06 p. m."
 * - Año distinto: "Vie 27 mar 2027 · 6:06 p. m."
 * Si date es null/undefined o inválido, devuelve string vacío (el chip muestra "Sin fecha" aparte).
 */
export function formatNextActionDateLabel(
  date: string | null | undefined,
  now: Date = new Date()
): string {
  if (date == null || date.trim() === '') return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''

  const leadYmd = toYmdInMonterrey(d)
  const todayYmd = getTodayYmd(now)
  const tomorrowYmd = addDaysToYmd(todayYmd, 1)

  const opts = { timeZone: TZ } as const
  let timeStr = new Intl.DateTimeFormat('es-MX', {
    ...opts,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d)
  timeStr = timeStr
    .replace(/\b(a\.?m\.?)\b/gi, 'a. m.')
    .replace(/\b(p\.?m\.?)\b/gi, 'p. m.')

  let prefix: string
  if (leadYmd === todayYmd) {
    prefix = 'Hoy'
  } else if (leadYmd === tomorrowYmd) {
    prefix = 'Mañana'
  } else {
    const weekday = new Intl.DateTimeFormat('es-MX', { ...opts, weekday: 'short' }).format(d)
    const day = new Intl.DateTimeFormat('es-MX', { ...opts, day: 'numeric' }).format(d)
    const month = new Intl.DateTimeFormat('es-MX', { ...opts, month: 'short' }).format(d)
    const w = weekday.charAt(0).toUpperCase() + weekday.slice(1)
    const m = month.charAt(0).toLowerCase() + month.slice(1)
    const [leadYear] = leadYmd.split('-').map(Number)
    const [currentYear] = todayYmd.split('-').map(Number)
    prefix = leadYear !== currentYear ? `${w} ${day} ${m} ${leadYear}` : `${w} ${day} ${m}`
  }

  return `${prefix} · ${timeStr}`
}

/** Solo la hora para Kanban (línea 2 cuando es hoy/mañana): "9:00 a. m." */
export function formatNextActionTimeOnly(date: string | null | undefined): string {
  if (date == null || date.trim() === '') return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  const opts = { timeZone: TZ } as const
  let timeStr = new Intl.DateTimeFormat('es-MX', {
    ...opts,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d)
  timeStr = timeStr
    .replace(/\b(a\.?m\.?)\b/gi, 'a. m.')
    .replace(/\b(p\.?m\.?)\b/gi, 'p. m.')
  return timeStr
}

/** Etiqueta de urgencia para Kanban línea 1: "Atrasado", "Hoy", "Mañana" o "" (futuro). */
export function getNextActionUrgencyLabel(
  date: string | null | undefined,
  now: Date = new Date()
): string {
  if (date == null || date.trim() === '') return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  const leadYmd = toYmdInMonterrey(d)
  const todayYmd = getTodayYmd(now)
  const tomorrowYmd = addDaysToYmd(todayYmd, 1)
  if (leadYmd < todayYmd) return 'Atrasado'
  if (leadYmd === todayYmd) return 'Hoy'
  if (leadYmd === tomorrowYmd) return 'Mañana'
  return ''
}
