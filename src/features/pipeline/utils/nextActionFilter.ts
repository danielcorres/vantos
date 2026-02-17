/**
 * Filtro por próxima acción usando fecha en America/Monterrey.
 */

const TZ = 'America/Monterrey'

function toMonterreyDateString(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)
  const y = parts.find((p) => p.type === 'year')?.value ?? ''
  const m = parts.find((p) => p.type === 'month')?.value ?? ''
  const day = parts.find((p) => p.type === 'day')?.value ?? ''
  return `${y}-${m}-${day}`
}

function getMonterreyWeekday(d: Date): number {
  const s = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d)
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[s] ?? 0
}

export type NextActionFilter = 'overdue' | 'today' | 'week' | 'later'

export function getNextActionBucket(
  nextActionAt: string | null | undefined,
  now: Date = new Date()
): NextActionFilter | null {
  if (!nextActionAt) return null
  const d = new Date(nextActionAt)
  if (isNaN(d.getTime())) return null
  const leadDateStr = toMonterreyDateString(d)
  const todayStr = toMonterreyDateString(now)
  if (leadDateStr < todayStr) return 'overdue'
  if (leadDateStr === todayStr) return 'today'
  const weekday = getMonterreyWeekday(now)
  const daysToSunday = 6 - weekday
  const sunday = new Date(now)
  sunday.setDate(sunday.getDate() + daysToSunday)
  const endOfWeekStr = toMonterreyDateString(sunday)
  if (leadDateStr <= endOfWeekStr) return 'week'
  return 'later'
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
