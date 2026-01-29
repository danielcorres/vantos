import { supabase } from '../../../lib/supabaseClient'
import { pipelineApi } from '../../pipeline/pipeline.api'
import type {
  CalendarEvent,
  CreateCalendarEventInput,
  UpdateCalendarEventInput,
  AppointmentStatus,
} from '../types/calendar.types'
import { getStageSlugForAppointmentType } from '../utils/appointmentStageRules'
import type { CalendarStageSlug } from '../utils/appointmentStageRules'

function normalizeEvent(row: Record<string, unknown>): CalendarEvent {
  return {
    id: row.id as string,
    owner_user_id: row.owner_user_id as string,
    lead_id: (row.lead_id as string | null) ?? null,
    type: row.type as CalendarEvent['type'],
    status: row.status as CalendarEvent['status'],
    starts_at: row.starts_at as string,
    ends_at: row.ends_at as string,
    title: (row.title as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    meeting_link: (row.meeting_link as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

function validateStartsBeforeEnds(starts_at: string, ends_at: string): void {
  const start = new Date(starts_at).getTime()
  const end = new Date(ends_at).getTime()
  if (start >= end) {
    throw new Error('starts_at debe ser anterior a ends_at')
  }
}

const stageIdBySlugCache = new Map<CalendarStageSlug, string>()

async function getStageIdBySlug(slug: CalendarStageSlug): Promise<string | null> {
  const cached = stageIdBySlugCache.get(slug)
  if (cached) return cached
  try {
    const stages = await pipelineApi.getStages()
    const stage = stages.find((s) => s.slug === slug)
    if (stage) {
      stageIdBySlugCache.set(slug, stage.id)
      return stage.id
    }
  } catch (_) {
    // fall through to null
  }
  return null
}

function calendarStageIdempotencyKey(eventId: string, slug: CalendarStageSlug): string {
  return `calendar:${eventId}:stage:${slug}`
}

async function tryMoveLeadToStageForAppointment(
  leadId: string,
  eventId: string,
  type: CalendarEvent['type']
): Promise<void> {
  const slug = getStageSlugForAppointmentType(type)
  if (!slug) return
  const stageId = await getStageIdBySlug(slug)
  if (!stageId) {
    console.warn(`[calendar] No se encontró stage con slug "${slug}"`)
    return
  }
  try {
    await pipelineApi.moveLeadStage(
      leadId,
      stageId,
      calendarStageIdempotencyKey(eventId, slug)
    )
  } catch (err) {
    console.warn('[calendar] No se pudo mover etapa del lead:', err)
  }
}

export const calendarApi = {
  /**
   * Eventos en un rango de fechas (inclusive en starts_at).
   * Orden: starts_at asc.
   */
  async listEventsInRange(params: {
    from: string
    to: string
    status?: AppointmentStatus[]
  }): Promise<CalendarEvent[]> {
    let query = supabase
      .from('calendar_events')
      .select('*')
      .gte('starts_at', params.from)
      .lte('starts_at', params.to)
      .order('starts_at', { ascending: true })

    if (params.status != null && params.status.length > 0) {
      query = query.in('status', params.status)
    }

    const { data, error } = await query

    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => normalizeEvent(row as Record<string, unknown>))
  },

  /**
   * Próximos eventos desde una fecha (por defecto ahora).
   * Orden: starts_at asc. limit por defecto 50.
   */
  async listUpcomingEvents(params?: {
    from?: string
    limit?: number
  }): Promise<CalendarEvent[]> {
    const from = params?.from ?? new Date().toISOString()
    const limit = params?.limit ?? 50

    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .gte('starts_at', from)
      .in('status', ['scheduled'])
      .order('starts_at', { ascending: true })
      .limit(limit)

    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => normalizeEvent(row as Record<string, unknown>))
  },

  /**
   * Próxima cita programada por lead (una por lead_id).
   * Solo scheduled, starts_at >= now, orden starts_at asc; reduce en JS al primer evento por lead_id.
   * Si leadIds está vacío, devuelve {}.
   */
  async getNextScheduledEventByLeadIds(leadIds: string[]): Promise<Record<string, CalendarEvent | null>> {
    if (leadIds.length === 0) return {}
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .in('lead_id', leadIds)
      .eq('status', 'scheduled')
      .gte('starts_at', now)
      .order('starts_at', { ascending: true })

    if (error) throw new Error(error.message)
    const events = (data ?? []).map((row) => normalizeEvent(row as Record<string, unknown>))
    const map: Record<string, CalendarEvent | null> = {}
    for (const id of leadIds) map[id] = null
    for (const ev of events) {
      if (ev.lead_id && map[ev.lead_id] === null) map[ev.lead_id] = ev
    }
    return map
  },

  /**
   * Eventos de un lead. Orden: starts_at desc (más reciente primero, historial).
   */
  async listLeadEvents(leadId: string): Promise<CalendarEvent[]> {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('lead_id', leadId)
      .order('starts_at', { ascending: false })

    if (error) throw new Error(error.message)
    return (data ?? []).map((row) => normalizeEvent(row as Record<string, unknown>))
  },

  async createEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
    validateStartsBeforeEnds(input.starts_at, input.ends_at)

    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError) throw new Error(userError.message)
    if (!userData.user?.id) throw new Error('Usuario no autenticado')

    const row = {
      owner_user_id: userData.user.id,
      lead_id: input.lead_id ?? null,
      type: input.type,
      status: input.status ?? 'scheduled',
      starts_at: input.starts_at,
      ends_at: input.ends_at,
      title: input.title ?? null,
      notes: input.notes ?? null,
      location: input.location ?? null,
      meeting_link: input.meeting_link ?? null,
    }

    const { data, error } = await supabase
      .from('calendar_events')
      .insert(row)
      .select()
      .single()

    if (error) throw new Error(error.message)
    const event = normalizeEvent(data as Record<string, unknown>)

    if (event.lead_id) {
      await tryMoveLeadToStageForAppointment(event.lead_id, event.id, input.type)
    }

    return event
  },

  async updateEvent(id: string, input: UpdateCalendarEventInput): Promise<CalendarEvent> {
    if (input.starts_at != null && input.ends_at != null) {
      validateStartsBeforeEnds(input.starts_at, input.ends_at)
    }

    const updates = Object.fromEntries(
      Object.entries(input).filter(([, v]) => v !== undefined)
    ) as Record<string, unknown>

    const { data, error } = await supabase
      .from('calendar_events')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    const event = normalizeEvent(data as Record<string, unknown>)

    if (event.lead_id && (event.type === 'first_meeting' || event.type === 'closing')) {
      await tryMoveLeadToStageForAppointment(event.lead_id, event.id, event.type)
    }

    return event
  },

  async setEventStatus(id: string, status: AppointmentStatus): Promise<CalendarEvent> {
    const { data, error } = await supabase
      .from('calendar_events')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return normalizeEvent(data as Record<string, unknown>)
  },

  async deleteEvent(id: string): Promise<void> {
    const { error } = await supabase.from('calendar_events').delete().eq('id', id)

    if (error) throw new Error(error.message)
  },
}
