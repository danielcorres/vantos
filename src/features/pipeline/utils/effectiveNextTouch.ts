import type { Lead } from '../pipeline.api'
import type { CalendarEvent } from '../../calendar/types/calendar.types'
import {
  aggregateNextActionColumnCounts,
  getNextActionUrgency,
  type NextActionColumnCounts,
  type NextActionUrgency,
} from '../../../shared/utils/nextAction'

/**
 * Fecha efectiva para prioridad Kanban: si hay cita programada, usa su inicio;
 * si no, el próximo paso del lead (`next_action_at`).
 */
export function getEffectiveNextTouchIso(
  nextAppointment: CalendarEvent | null | undefined,
  next_action_at: string | null | undefined
): string | null | undefined {
  if (nextAppointment?.status === 'scheduled' && nextAppointment.starts_at?.trim()) {
    return nextAppointment.starts_at
  }
  const na = next_action_at?.trim()
  return na || null
}

export function getEffectiveNextTouchUrgency(
  nextAppointment: CalendarEvent | null | undefined,
  next_action_at: string | null | undefined,
  now?: Date
): NextActionUrgency {
  return getNextActionUrgency(getEffectiveNextTouchIso(nextAppointment, next_action_at), now)
}

export function sortLeadsByEffectiveNextTouch<T extends Lead>(
  leads: T[],
  appointmentByLeadId: Record<string, CalendarEvent | null>
): T[] {
  return [...leads].sort((a, b) => {
    const ua = getEffectiveNextTouchUrgency(appointmentByLeadId[a.id], a.next_action_at)
    const ub = getEffectiveNextTouchUrgency(appointmentByLeadId[b.id], b.next_action_at)
    const rank: Record<NextActionUrgency, number> = {
      overdue: 0,
      today: 1,
      tomorrow: 2,
      future: 3,
      none: 4,
    }
    if (rank[ua] !== rank[ub]) return rank[ua] - rank[ub]
    const ta = new Date(getEffectiveNextTouchIso(appointmentByLeadId[a.id], a.next_action_at) ?? 0).getTime()
    const tb = new Date(getEffectiveNextTouchIso(appointmentByLeadId[b.id], b.next_action_at) ?? 0).getTime()
    const safeTa = Number.isFinite(ta) ? ta : Infinity
    const safeTb = Number.isFinite(tb) ? tb : Infinity
    if (safeTa !== safeTb) return safeTa - safeTb
    return (a.full_name || '').localeCompare(b.full_name || '')
  })
}

/** Conteos de columna usando fecha efectiva (cita o próximo paso). */
export function aggregateEffectiveNextTouchColumnCounts(
  leads: Lead[],
  appointmentByLeadId: Record<string, CalendarEvent | null>
): NextActionColumnCounts {
  const synthetic = leads.map((l) => ({
    next_action_at: getEffectiveNextTouchIso(appointmentByLeadId[l.id], l.next_action_at) ?? null,
  }))
  return aggregateNextActionColumnCounts(synthetic)
}

