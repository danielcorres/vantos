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
  type: 'meeting',
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
  it('sin cita → agendar en cualquier etapa (slug ignorado)', () => {
    const g = getSchedulingGuidance(lead(), 'contactos_nuevos', null, emptySummary())
    expect(g.mode).toBe('agendar')
    expect(g.buttonLabel).toBe('Agendar')
    expect(g.suggestedType).toBe('meeting')
    expect(g.suggestedTitle).toContain('Cita:')
    expect(g.editEventId).toBeNull()
    expect(g.helpText).toContain('tipo de cita')
  })

  it('solicitudes_ingresadas sin cita → agendar (antes era none)', () => {
    const g = getSchedulingGuidance(lead(), 'solicitudes_ingresadas', null, emptySummary())
    expect(g.mode).toBe('agendar')
    expect(g.buttonLabel).toBe('Agendar')
    expect(g.editEventId).toBeNull()
  })

  it('con cita scheduled → reprogramar', () => {
    const ap = scheduledFirst('evt-1')
    const g = getSchedulingGuidance(lead(), 'contactos_nuevos', ap, emptySummary())
    expect(g.mode).toBe('reprogramar')
    expect(g.buttonLabel).toBe('Reprogramar')
    expect(g.editEventId).toBe(ap.id)
    expect(g.suggestedType).toBe('meeting')
  })

  it('citas_agendadas con primera completada y sin cita → agendar (tipo libre en modal)', () => {
    const sum: LeadSchedulingSummary = {
      ...emptySummary(),
      has_completed_first: true,
    }
    const g = getSchedulingGuidance(lead(), 'citas_agendadas', null, sum)
    expect(g.mode).toBe('agendar')
    expect(g.suggestedType).toBe('meeting')
  })
})
