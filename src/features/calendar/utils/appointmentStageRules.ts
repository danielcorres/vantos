import type { AppointmentType } from '../types/calendar.types'

export type CalendarStageSlug = 'citas_agendadas' | 'citas_cierre'

/**
 * Slug de etapa Pipeline V3 a aplicar según tipo de cita.
 * - first_meeting → Citas Agendadas
 * - closing → Citas de Cierre
 * - follow_up → no cambia etapa (null)
 */
export function getStageSlugForAppointmentType(
  type: AppointmentType
): CalendarStageSlug | null {
  switch (type) {
    case 'first_meeting':
      return 'citas_agendadas'
    case 'closing':
      return 'citas_cierre'
    case 'follow_up':
      return null
    default:
      return null
  }
}
