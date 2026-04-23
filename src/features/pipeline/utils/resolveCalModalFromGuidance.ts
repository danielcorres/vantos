import { calendarApi } from '../../calendar/api/calendar.api'
import type { AppointmentType, CalendarEvent } from '../../calendar/types/calendar.types'
import {
  getSchedulingGuidance,
  type LeadSchedulingSummary,
} from '../../calendar/utils/stageSchedulingGuidance'
import type { Lead, PipelineStage } from '../pipeline.api'

export type CalModalOpenResult =
  | { kind: 'toast'; level: 'info' | 'error'; message: string }
  | {
      kind: 'edit'
      leadId: string
      event: CalendarEvent
      helpText: string | null
    }
  | {
      kind: 'create'
      leadId: string
      initialAppointmentType: AppointmentType | undefined
      initialTitle: string | undefined
      lockType: AppointmentType | null
      helpText: string | null
    }

export async function resolveCalModalFromGuidance(
  leadId: string,
  ctx: {
    leads: Lead[]
    stages: PipelineStage[]
    nextAppointmentByLeadId: Record<string, CalendarEvent | null | undefined>
    schedulingSummaryByLeadId: Record<string, LeadSchedulingSummary | undefined>
  }
): Promise<CalModalOpenResult> {
  const lead = ctx.leads.find((l) => l.id === leadId)
  if (!lead) {
    return { kind: 'toast', level: 'info', message: 'No se encontró el lead.' }
  }
  const stageSlug = ctx.stages.find((s) => s.id === lead.stage_id)?.slug
  const next = ctx.nextAppointmentByLeadId[leadId] ?? null
  const summary = ctx.schedulingSummaryByLeadId[leadId]
  const guidance = getSchedulingGuidance(lead, stageSlug, next ?? undefined, summary)

  if (guidance.mode === 'none' && !guidance.editEventId) {
    return {
      kind: 'toast',
      level: 'info',
      message: guidance.helpText?.trim() || 'No hay acción de agenda sugerida en esta etapa.',
    }
  }

  if (guidance.editEventId) {
    try {
      const ev = await calendarApi.getEventById(guidance.editEventId)
      if (ev && ev.lead_id === leadId) {
        return {
          kind: 'edit',
          leadId,
          event: ev,
          helpText: guidance.helpText,
        }
      }
    } catch {
      /* continuar a crear */
    }
  }

  const lockType: AppointmentType | null =
    guidance.mode === 'agendar_cierre'
      ? 'closing'
      : guidance.mode === 'revision_anual'
        ? 'follow_up'
        : null

  return {
    kind: 'create',
    leadId,
    initialAppointmentType: guidance.suggestedType,
    initialTitle: guidance.suggestedTitle?.trim() || undefined,
    lockType,
    helpText: guidance.helpText,
  }
}
