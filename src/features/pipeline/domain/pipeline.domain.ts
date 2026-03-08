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
 * Etiqueta de fecha para próximo paso: "Hoy · 6:30 p.m.", "Mañana · 10:00 a.m.", "Mié 18 · 12:00 p.m." (es-MX, TZ).
 * Si date es null/undefined o inválido, devuelve string vacío (el chip puede mostrar "Sin fecha" aparte).
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

  let prefix: string
  if (leadYmd === todayYmd) {
    prefix = 'Hoy'
  } else if (leadYmd === tomorrowYmd) {
    prefix = 'Mañana'
  } else {
    const weekday = new Intl.DateTimeFormat('es-MX', {
      timeZone: TZ,
      weekday: 'short',
    }).format(d)
    const day = new Intl.DateTimeFormat('es-MX', {
      timeZone: TZ,
      day: 'numeric',
    }).format(d)
    prefix = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${day}`
  }

  const time = new Intl.DateTimeFormat('es-MX', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(d)
    .replace(/\s*\.\s*\./g, '.')
  return `${prefix} · ${time}`
}
