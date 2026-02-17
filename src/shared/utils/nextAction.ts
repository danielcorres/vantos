/**
 * Lógica unificada de próxima acción en America/Monterrey.
 * Filtros, buckets, labels y conteos usan esta timezone de forma consistente.
 */

export const TZ = 'America/Monterrey'

export type NextActionFilter = 'overdue' | 'today' | 'week' | 'later'

/** YYYY-MM-DD en America/Monterrey (Intl, sin usar timezone local implícito). */
export function toYmdInMonterrey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const y = parts.find((p) => p.type === 'year')?.value ?? ''
  const m = parts.find((p) => p.type === 'month')?.value ?? ''
  const d = parts.find((p) => p.type === 'day')?.value ?? ''
  return `${y}-${m}-${d}`
}

/** Hoy en America/Monterrey (YYYY-MM-DD). */
export function getTodayYmd(now: Date = new Date()): string {
  return toYmdInMonterrey(now)
}

/** Domingo de la semana actual en America/Monterrey (YYYY-MM-DD). */
export function getEndOfWeekYmd(now: Date): string {
  const todayYmd = getTodayYmd(now)
  const w = getMonterreyWeekday(now)
  const daysToSunday = (7 - w) % 7
  return addDaysToYmd(todayYmd, daysToSunday)
}

function getMonterreyWeekday(d: Date): number {
  const s = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d)
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[s] ?? 0
}

const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/

/** Valida formato YYYY-MM-DD (solo sintaxis, no fechas válidas). */
function isValidYmd(ymd: string): boolean {
  if (typeof ymd !== 'string') return false
  if (!YMD_REGEX.test(ymd)) return false
  const [y, m, d] = ymd.split('-').map(Number)
  return !Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)
}

/**
 * Suma n días a un YMD. Soporta n negativo.
 * Si ymd inválido o n no finito, regresa ymd sin cambios.
 * Usa Date.UTC para evitar timezone local implícito.
 */
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

export function getNextActionBucket(
  next_action_at: string | null | undefined,
  now: Date = new Date()
): NextActionFilter | null {
  if (!next_action_at) return null
  const d = new Date(next_action_at)
  if (isNaN(d.getTime())) return null
  const leadYmd = toYmdInMonterrey(d)
  const todayYmd = getTodayYmd(now)
  if (leadYmd < todayYmd) return 'overdue'
  if (leadYmd === todayYmd) return 'today'
  const endOfWeekYmd = getEndOfWeekYmd(now)
  if (leadYmd <= endOfWeekYmd) return 'week'
  return 'later'
}

/** Días que next_action_at está vencido en America/Monterrey (0 si no vencido). */
export function daysOverdue(next_action_at: string | null | undefined, now: Date = new Date()): number {
  if (!next_action_at) return 0
  const d = new Date(next_action_at)
  if (isNaN(d.getTime())) return 0
  const leadYmd = toYmdInMonterrey(d)
  const todayYmd = getTodayYmd(now)
  if (leadYmd >= todayYmd) return 0
  const [ly, lm, ld] = leadYmd.split('-').map(Number)
  const [ty, tm, td] = todayYmd.split('-').map(Number)
  const leadUtc = Date.UTC(ly, lm - 1, ld)
  const todayUtc = Date.UTC(ty, tm - 1, td)
  return Math.floor((todayUtc - leadUtc) / (24 * 60 * 60 * 1000))
}

/** true si el próximo paso está vencido 7+ días (America/Monterrey). */
export function isSinRespuesta(next_action_at: string | null | undefined, now: Date = new Date()): boolean {
  return daysOverdue(next_action_at, now) >= 7
}

/**
 * Label en America/Monterrey: "Hoy 5:00 pm", "Mañana 10:00 am", "Mié 12:00 pm".
 * Horario formateado con timeZone TZ.
 */
export function getNextActionLabel(
  next_action_at: string | null,
  now: Date = new Date()
): string {
  if (next_action_at == null) return '—'
  const d = new Date(next_action_at)
  if (isNaN(d.getTime())) return '—'

  const leadYmd = toYmdInMonterrey(d)
  const todayYmd = getTodayYmd(now)
  const tomorrowYmd = addDaysToYmd(todayYmd, 1)

  let prefix: string
  if (leadYmd === todayYmd) {
    prefix = 'Hoy'
  } else if (leadYmd === tomorrowYmd) {
    prefix = 'Mañana'
  } else {
    const short = new Intl.DateTimeFormat('es-MX', {
      timeZone: TZ,
      weekday: 'short',
    }).format(d)
    prefix = short.charAt(0).toUpperCase() + short.slice(1)
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(d)
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '12'
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00'
  const dayPeriod = (parts.find((p) => p.type === 'dayPeriod')?.value ?? 'am').toLowerCase()
  const ampm = dayPeriod.includes('p') ? 'pm' : 'am'
  const timeStr = `${hour}:${minute} ${ampm}`

  return `${prefix} ${timeStr}`
}

export function filterLeadsByNextAction<T extends { next_action_at?: string | null }>(
  leads: T[],
  filter: NextActionFilter,
  now: Date = new Date()
): T[] {
  return leads.filter((lead) => getNextActionBucket(lead.next_action_at, now) === filter)
}

export function countLeadsByNextAction(
  leads: { next_action_at?: string | null }[],
  now: Date = new Date()
): Record<NextActionFilter, number> {
  const counts: Record<NextActionFilter, number> = {
    overdue: 0,
    today: 0,
    week: 0,
    later: 0,
  }
  for (const lead of leads) {
    const bucket = getNextActionBucket(lead.next_action_at, now)
    if (bucket) counts[bucket]++
  }
  return counts
}
