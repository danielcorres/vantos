import type { CalendarEvent } from '../types/calendar.types'

/**
 * Etiqueta visible de la cita: nombre actual del lead (JOIN), snapshot si el lead fue borrado,
 * título libre como respaldo.
 */
export function eventDisplayLabel(ev: Pick<CalendarEvent, 'lead_full_name' | 'lead_name_snapshot' | 'title'>): string {
  const fromLead = ev.lead_full_name?.trim()
  if (fromLead) return fromLead
  const snap = ev.lead_name_snapshot?.trim()
  if (snap) return snap
  const t = ev.title?.trim()
  if (t) return t
  return 'Sin título'
}
