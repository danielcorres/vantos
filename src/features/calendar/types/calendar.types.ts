/**
 * Tipos del módulo Calendario interno.
 * Tabla: public.calendar_events
 * RLS: owner_user_id = auth.uid()
 */

/** Slugs en BD; etiquetas en español en UI (Llamada, Mensaje, Reunión, Otro). */
export type AppointmentType = 'call' | 'message' | 'meeting' | 'other'

/** Orden estable para selects y validación en cliente. */
export const APPOINTMENT_TYPES: readonly AppointmentType[] = ['call', 'message', 'meeting', 'other'] as const

export type AppointmentStatus = 'scheduled' | 'completed' | 'no_show' | 'canceled'

export interface CalendarEvent {
  id: string
  owner_user_id: string
  lead_id: string | null
  type: AppointmentType
  status: AppointmentStatus
  starts_at: string
  ends_at: string
  title: string | null
  notes: string | null
  location: string | null
  meeting_link: string | null
  /** ID del evento en Google Calendar (integración futura). */
  google_event_id: string | null
  created_at: string
  updated_at: string
}

/**
 * Input para crear evento. owner_user_id se asigna en API desde auth.uid().
 * lead_id opcional (eventos sin lead permitidos).
 */
export type CreateCalendarEventInput = {
  type: AppointmentType
  starts_at: string
  ends_at: string
  lead_id?: string | null
  status?: AppointmentStatus
  title?: string | null
  notes?: string | null
  location?: string | null
  meeting_link?: string | null
  google_event_id?: string | null
}

export type UpdateCalendarEventInput = Partial<CreateCalendarEventInput>
