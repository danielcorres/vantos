import type { AppointmentType } from '../types/calendar.types'
import type { CalendarEvent } from '../types/calendar.types'
import type { Lead } from '../../pipeline/pipeline.api'

export type SchedulingGuidanceMode =
  | 'agendar_primera'
  | 'agendar_cierre'
  | 'reprogramar'
  | 'revision_anual'
  | 'none'

export type SchedulingGuidance = {
  mode: SchedulingGuidanceMode
  buttonLabel: string
  suggestedType: AppointmentType
  suggestedTitle: string
  /** Si hay cita futura para abrir en edición (reprogramar). */
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
 * Reglas de CTA y defaults del modal según slug de etapa e historial de citas.
 */
export function getSchedulingGuidance(
  lead: Pick<Lead, 'id' | 'full_name'>,
  stageSlug: string | undefined,
  nextAppointment: CalendarEvent | null | undefined,
  summary: LeadSchedulingSummary | undefined
): SchedulingGuidance {
  const slug = stageSlug ?? ''
  const nm = nameOf(lead)
  const next = nextAppointment?.status === 'scheduled' ? nextAppointment : null
  const sum = summary ?? {
    has_completed_first: false,
    has_completed_closing: false,
    next_scheduled_id: null,
    next_scheduled_starts_at: null,
    next_scheduled_type: null,
  }

  if (slug === 'solicitudes_ingresadas') {
    return {
      mode: 'none',
      buttonLabel: '—',
      suggestedType: 'follow_up',
      suggestedTitle: '',
      editEventId: null,
      helpText: null,
    }
  }

  if (slug === 'casos_ganados') {
    return {
      mode: 'revision_anual',
      buttonLabel: 'Revisión anual',
      suggestedType: 'follow_up',
      suggestedTitle: `Revisión anual: ${nm}`,
      editEventId: next?.id ?? null,
      helpText: 'Agenda la revisión anual del cliente.',
    }
  }

  if (slug === 'contactos_nuevos') {
    return {
      mode: 'agendar_primera',
      buttonLabel: next ? 'Reprogramar' : 'Agendar',
      suggestedType: 'first_meeting',
      suggestedTitle: `Cita inicial: ${nm}`,
      editEventId: next?.id ?? null,
      helpText: 'Primera cita con el prospecto.',
    }
  }

  if (slug === 'citas_agendadas' || slug === 'casos_abiertos') {
    if (next?.type === 'first_meeting') {
      return {
        mode: 'reprogramar',
        buttonLabel: 'Reprogramar',
        suggestedType: 'first_meeting',
        suggestedTitle: next.title?.trim() || `Cita inicial: ${nm}`,
        editEventId: next.id,
        helpText: 'Cambia fecha u hora de la cita inicial.',
      }
    }
    if (next?.type === 'closing') {
      return {
        mode: 'reprogramar',
        buttonLabel: 'Reprogramar cierre',
        suggestedType: 'closing',
        suggestedTitle: next.title?.trim() || `Cita de cierre: ${nm}`,
        editEventId: next.id,
        helpText: null,
      }
    }
    if (sum.has_completed_first && !next) {
      return {
        mode: 'agendar_cierre',
        buttonLabel: 'Agendar cierre',
        suggestedType: 'closing',
        suggestedTitle: `Cita de cierre: ${nm}`,
        editEventId: null,
        helpText: 'La cita inicial ya se dio; agenda la de cierre.',
      }
    }
    return {
      mode: 'agendar_primera',
      buttonLabel: next ? 'Reprogramar' : 'Agendar',
      suggestedType: 'first_meeting',
      suggestedTitle: `Cita inicial: ${nm}`,
      editEventId: next?.id ?? null,
      helpText: null,
    }
  }

  if (slug === 'citas_cierre') {
    if (next?.type === 'closing') {
      return {
        mode: 'reprogramar',
        buttonLabel: 'Reprogramar cierre',
        suggestedType: 'closing',
        suggestedTitle: next.title?.trim() || `Cita de cierre: ${nm}`,
        editEventId: next.id,
        helpText: null,
      }
    }
    if (sum.has_completed_closing && !next) {
      return {
        mode: 'none',
        buttonLabel: '—',
        suggestedType: 'closing',
        suggestedTitle: '',
        editEventId: null,
        helpText: 'Marca propuesta presentada desde el detalle del lead o al completar la cita.',
      }
    }
    return {
      mode: 'agendar_cierre',
      buttonLabel: next ? 'Reprogramar cierre' : 'Agendar cierre',
      suggestedType: 'closing',
      suggestedTitle: `Cita de cierre: ${nm}`,
      editEventId: next?.id ?? null,
      helpText: null,
    }
  }

  // Resto de etapas: mismo patrón genérico (cita o agendar seguimiento).
  return {
    mode: next ? 'reprogramar' : 'agendar_primera',
    buttonLabel: next ? 'Reprogramar' : 'Agendar',
    suggestedType: 'follow_up',
    suggestedTitle: `Seguimiento: ${nm}`,
    editEventId: next?.id ?? null,
    helpText: null,
  }
}
