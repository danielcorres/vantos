import { describe, it, expect } from 'vitest'
import { eventDisplayLabel } from './eventDisplay'

describe('eventDisplayLabel', () => {
  it('prioriza lead_full_name sobre title', () => {
    expect(
      eventDisplayLabel({
        lead_full_name: 'Ricardo',
        lead_name_snapshot: null,
        title: 'Lead viejo',
      })
    ).toBe('Ricardo')
  })

  it('usa snapshot si no hay join', () => {
    expect(
      eventDisplayLabel({
        lead_full_name: null,
        lead_name_snapshot: 'Eliminado',
        title: null,
      })
    ).toBe('Eliminado')
  })

  it('cae a title y luego Sin título', () => {
    expect(
      eventDisplayLabel({
        lead_full_name: null,
        lead_name_snapshot: null,
        title: 'Solo asunto',
      })
    ).toBe('Solo asunto')
    expect(eventDisplayLabel({ lead_full_name: null, lead_name_snapshot: null, title: null })).toBe('Sin título')
  })
})
