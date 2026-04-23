import type { AppointmentType } from '../types/calendar.types'

export type CalendarStageSlug = 'citas_agendadas' | 'citas_cierre'

/**
 * Slug de etapa Pipeline a aplicar según tipo de cita.
 * - meeting, call → Citas Agendadas
 * - message, other → no cambia etapa (null)
 */
export function getStageSlugForAppointmentType(
  type: AppointmentType
): CalendarStageSlug | null {
  switch (type) {
    case 'meeting':
    case 'call':
      return 'citas_agendadas'
    case 'message':
    case 'other':
      return null
    default:
      return null
  }
}
