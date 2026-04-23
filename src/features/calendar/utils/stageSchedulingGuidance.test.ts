import { describe, it, expect } from 'vitest'
import { getSchedulingGuidance, type LeadSchedulingSummary } from './stageSchedulingGuidance'
import type { Lead } from '../../pipeline/pipeline.api'
import type { CalendarEvent } from '../types/calendar.types'

const lead = (over: Partial<Pick<Lead, 'id' | 'full_name'>> = {}): Pick<Lead, 'id' | 'full_name'> => ({
  id: '00000000-0000-4000-8000-000000000001',
  full_name: 'María Prueba',
  ...over,
})

const emptySummary = (): LeadSchedulingSummary => ({
  has_completed_first: false,
  has_completed_closing: false,
  next_scheduled_id: null,
  next_scheduled_starts_at: null,
  next_scheduled_type: null,
})

const scheduledFirst = (id: string): CalendarEvent => ({
  id,
  owner_user_id: 'u',
  lead_id: lead().id,
  type: 'first_meeting',
  status: 'scheduled',
  starts_at: new Date(Date.now() + 864e5).toISOString(),
  ends_at: new Date(Date.now() + 864e5 + 36e5).toISOString(),
  title: null,
  notes: null,
  location: null,
  meeting_link: null,
  google_event_id: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})

describe('getSchedulingGuidance', () => {
  it('contactos_nuevos sin cita → agendar primera', () => {
    const g = getSchedulingGuidance(lead(), 'contactos_nuevos', null, emptySummary())
    expect(g.mode).toBe('agendar_primera')
    expect(g.buttonLabel).toBe('Agendar')
    expect(g.suggestedType).toBe('first_meeting')
    expect(g.suggestedTitle).toContain('Cita inicial')
  })

  it('contactos_nuevos con cita → reprogramar', () => {
    const ap = scheduledFirst('evt-1')
    const g = getSchedulingGuidance(lead(), 'contactos_nuevos', ap, emptySummary())
    expect(g.buttonLabel).toBe('Reprogramar')
    expect(g.editEventId).toBe(ap.id)
  })

  it('solicitudes_ingresadas → none', () => {
    const g = getSchedulingGuidance(lead(), 'solicitudes_ingresadas', null, emptySummary())
    expect(g.mode).toBe('none')
  })

  it('casos_ganados → revisión anual', () => {
    const g = getSchedulingGuidance(lead(), 'casos_ganados', null, emptySummary())
    expect(g.mode).toBe('revision_anual')
    expect(g.suggestedType).toBe('follow_up')
    expect(g.buttonLabel).toBe('Revisión anual')
  })

  it('citas_agendadas con primera completada y sin cita → agendar cierre', () => {
    const sum: LeadSchedulingSummary = {
      ...emptySummary(),
      has_completed_first: true,
    }
    const g = getSchedulingGuidance(lead(), 'citas_agendadas', null, sum)
    expect(g.mode).toBe('agendar_cierre')
    expect(g.suggestedType).toBe('closing')
  })
})
