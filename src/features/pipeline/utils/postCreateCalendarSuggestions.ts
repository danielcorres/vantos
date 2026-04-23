import type { AppointmentType } from '../../calendar/types/calendar.types'
import type { Lead, PipelineStage } from '../pipeline.api'

function stageSlugForLead(lead: Lead, stages: PipelineStage[]): string | null {
  return stages.find((s) => s.id === lead.stage_id)?.slug ?? null
}

/** Tipo sugerido según próxima acción del pipeline y etapa (no bloquea al usuario en el modal de cita). */
export function suggestPostCreateAppointmentType(
  lead: Lead,
  next_action_type: string | null,
  stages: PipelineStage[]
): AppointmentType {
  const slug = stageSlugForLead(lead, stages)
  const t = (next_action_type ?? '').trim().toLowerCase()
  if (t === 'meeting' && slug === 'contactos_nuevos') return 'first_meeting'
  return 'follow_up'
}

/** Título sugerido para contacto / seguimiento. */
export function suggestPostCreateAppointmentTitle(lead: Lead, next_action_type: string | null): string {
  const t = (next_action_type ?? '').trim().toLowerCase()
  if (t === 'contact') {
    const name = lead.full_name?.trim() || 'Lead'
    return `Seguimiento: ${name}`
  }
  return ''
}
