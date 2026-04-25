import type { AppointmentType } from '../types/calendar.types'
import type { CalendarEvent } from '../types/calendar.types'
import type { Lead } from '../../pipeline/pipeline.api'
import { eventDisplayLabel } from './eventDisplay'

export type SchedulingGuidanceMode = 'agendar' | 'reprogramar'

export type SchedulingGuidance = {
  mode: SchedulingGuidanceMode
  buttonLabel: string
  suggestedType: AppointmentType
  suggestedTitle: string
  /** Si hay cita programada para abrir en edición (reprogramar). */
  editEventId: string | null
  helpText: string | null
}

export type LeadSchedulingSummary = {
  has_completed_first: boolean
  has_completed_closing: boolean
  next_scheduled_id: string | null
  next_scheduled_starts_at: string | null
  next_scheduled_type: AppointmentType | null
}

function nameOf(lead: Pick<Lead, 'full_name'>): string {
  return lead.full_name?.trim() || 'Lead'
}

/**
 * CTA de agenda en pipeline: en cualquier etapa, Agendar o Reprogramar según haya cita `scheduled`.
 * El tipo concreto lo elige el asesor en el modal (`lockType` siempre null desde el resolver).
 */
export function getSchedulingGuidance(
  lead: Pick<Lead, 'id' | 'full_name'>,
  _stageSlug: string | undefined,
  nextAppointment: CalendarEvent | null | undefined,
  _summary: LeadSchedulingSummary | undefined
): SchedulingGuidance {
  const nm = nameOf(lead)
  const next = nextAppointment?.status === 'scheduled' ? nextAppointment : null

  if (next) {
    return {
      mode: 'reprogramar',
      buttonLabel: 'Reprogramar',
      suggestedType: next.type,
      suggestedTitle: (() => {
        const d = eventDisplayLabel(next)
        return d === 'Sin título' ? `Cita: ${nm}` : d
      })(),
      editEventId: next.id,
      helpText: null,
    }
  }

  return {
    mode: 'agendar',
    buttonLabel: 'Agendar',
    suggestedType: 'meeting',
    suggestedTitle: `Cita: ${nm}`,
    editEventId: null,
    helpText: 'Elige el tipo de cita en el formulario.',
  }
}
