/**
 * Formato de fecha/hora para citas en calendario (America/Monterrey).
 * Nombre histórico `getNextActionLabel`; el parámetro es el inicio ISO del evento.
 */

export const TZ = 'America/Monterrey'

/** YYYY-MM-DD en America/Monterrey. */
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

export function getTodayYmd(now: Date = new Date()): string {
  return toYmdInMonterrey(now)
}

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

/**
 * Label en America/Monterrey: "Hoy 5:00 pm", "Mañana 10:00 am", "Mié 12:00 pm".
 */
export function getNextActionLabel(startsAtIso: string | null, now: Date = new Date()): string {
  if (startsAtIso == null) return '—'
  const d = new Date(startsAtIso)
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
