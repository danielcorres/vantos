import type { Lead } from '../pipeline.api'
import type { CalendarEvent } from '../../calendar/types/calendar.types'
import { getTodayYmd, toYmdInMonterrey } from '../../../shared/utils/nextAction'

/** Urgencia del próximo toque visible en Kanban (solo citas `scheduled`). */
export type NextTouchUrgency = 'overdue' | 'today' | 'tomorrow' | 'future' | 'none'

const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/

function isValidYmd(ymd: string): boolean {
  if (typeof ymd !== 'string') return false
  if (!YMD_REGEX.test(ymd)) return false
  const [y, m, d] = ymd.split('-').map(Number)
  return !Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)
}

function addDaysToYmd(ymd: string, n: number): string {
  if (!isValidYmd(ymd) || !Number.isFinite(n)) return ymd
  const [y, m, d] = ymd.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + n))
  if (isNaN(next.getTime())) return ymd
  const y2 = next.getUTCFullYear()
  const m2 = String(next.getUTCMonth() + 1).padStart(2, '0')
  const d2 = String(next.getUTCDate()).padStart(2, '0')
  return `${y2}-${m2}-${d2}`
}

function touchUrgencyFromStartsAt(
  startsAtIso: string | null | undefined,
  now: Date = new Date()
): NextTouchUrgency {
  if (!startsAtIso || !startsAtIso.trim()) return 'none'
  const d = new Date(startsAtIso)
  if (isNaN(d.getTime())) return 'none'
  const leadYmd = toYmdInMonterrey(d)
  const todayYmd = getTodayYmd(now)
  const tomorrowYmd = addDaysToYmd(todayYmd, 1)
  if (leadYmd < todayYmd) return 'overdue'
  if (leadYmd === todayYmd) return 'today'
  if (leadYmd === tomorrowYmd) return 'tomorrow'
  return 'future'
}

export function getEffectiveNextTouchIso(
  nextAppointment: CalendarEvent | null | undefined
): string | null | undefined {
  if (nextAppointment?.status === 'scheduled' && nextAppointment.starts_at?.trim()) {
    return nextAppointment.starts_at
  }
  return null
}

export function getEffectiveNextTouchUrgency(
  nextAppointment: CalendarEvent | null | undefined,
  now?: Date
): NextTouchUrgency {
  return touchUrgencyFromStartsAt(getEffectiveNextTouchIso(nextAppointment), now)
}

const URGENCY_RANK: Record<NextTouchUrgency, number> = {
  overdue: 0,
  today: 1,
  tomorrow: 2,
  future: 3,
  none: 4,
}

export function sortLeadsByEffectiveNextTouch<T extends Lead>(
  leads: T[],
  appointmentByLeadId: Record<string, CalendarEvent | null>
): T[] {
  return [...leads].sort((a, b) => {
    const ua = getEffectiveNextTouchUrgency(appointmentByLeadId[a.id])
    const ub = getEffectiveNextTouchUrgency(appointmentByLeadId[b.id])
    if (URGENCY_RANK[ua] !== URGENCY_RANK[ub]) return URGENCY_RANK[ua] - URGENCY_RANK[ub]
    const ta = new Date(getEffectiveNextTouchIso(appointmentByLeadId[a.id]) ?? 0).getTime()
    const tb = new Date(getEffectiveNextTouchIso(appointmentByLeadId[b.id]) ?? 0).getTime()
    const safeTa = Number.isFinite(ta) ? ta : Infinity
    const safeTb = Number.isFinite(tb) ? tb : Infinity
    if (safeTa !== safeTb) return safeTa - safeTb
    return (a.full_name || '').localeCompare(b.full_name || '')
  })
}
