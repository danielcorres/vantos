import { describe, expect, it } from 'vitest'
import { addDaysYmd } from '../../../shared/utils/dates'
import {
  getAdvisorMilestoneStatus,
  getPhase1PolicyWindow,
  getPhase2CumulativeWindow,
  PHASE1_POLICIES_TARGET,
  PHASE2_POLICIES_TARGET,
} from './advisorMilestones'

/** Instantáneo que cae en día civil 2026-02-15 en America/Monterrey (aprox.). */
const NOW_2026_02_15_MTY = new Date('2026-02-15T18:00:00.000Z')

/** Después de 90 días desde 2026-01-01 (Fase 1 vencida). */
const NOW_2026_06_10_MTY = new Date('2026-06-10T18:00:00.000Z')

function baseInput(over: Partial<Parameters<typeof getAdvisorMilestoneStatus>[0]>) {
  return {
    advisor_status: 'asesor_12_meses' as const,
    key_activation_date: null as string | null,
    connection_date: null as string | null,
    life_policies_paid_in_phase1: 0,
    life_policies_cumulative_phase2: 0,
    ...over,
  }
}

describe('getPhase1PolicyWindow', () => {
  it('devuelve [key, key+91d) para la RPC', () => {
    const w = getPhase1PolicyWindow('2026-01-01')
    expect(w).not.toBeNull()
    expect(w!.from_ymd).toBe('2026-01-01')
    expect(w!.to_ymd).toBe(addDaysYmd('2026-01-01', 91))
  })

  it('devuelve null sin fecha', () => {
    expect(getPhase1PolicyWindow(null)).toBeNull()
  })
})

describe('getPhase2CumulativeWindow', () => {
  it('devuelve desde key hasta connection+91d', () => {
    const w = getPhase2CumulativeWindow('2026-01-01', '2026-03-01')
    expect(w).not.toBeNull()
    expect(w!.from_ymd).toBe('2026-01-01')
    expect(w!.to_ymd).toBe(addDaysYmd('2026-03-01', 91))
  })

  it('devuelve null si falta conexión o clave', () => {
    expect(getPhase2CumulativeWindow(null, '2026-03-01')).toBeNull()
    expect(getPhase2CumulativeWindow('2026-01-01', null)).toBeNull()
  })
})

describe('getAdvisorMilestoneStatus', () => {
  it('no aplica si el estatus no es asesor_12_meses', () => {
    const s = getAdvisorMilestoneStatus(
      baseInput({ advisor_status: 'nueva_generacion' }),
      NOW_2026_02_15_MTY
    )
    expect(s.applies).toBe(false)
  })

  it('sin key_activation: fase 1 sin iniciar', () => {
    const s = getAdvisorMilestoneStatus(
      baseInput({ connection_date: '2026-03-01' }),
      NOW_2026_02_15_MTY
    )
    expect(s.applies).toBe(true)
    expect(s.phase1.state).toBe('not_started')
    expect(s.phase2.state).toBe('not_started')
  })

  it('con clave y 0 pólizas a mitad de ventana: fase 1 en curso', () => {
    const s = getAdvisorMilestoneStatus(
      baseInput({
        key_activation_date: '2026-01-01',
        life_policies_paid_in_phase1: 0,
      }),
      NOW_2026_02_15_MTY
    )
    expect(s.phase1.state).toBe('in_progress')
    expect(s.phase1.policies_count).toBe(0)
    expect(s.phase1.policies_target).toBe(PHASE1_POLICIES_TARGET)
    expect(s.current_phase).toBe(1)
  })

  it('con 6 pólizas en ventana: fase 1 completada', () => {
    const s = getAdvisorMilestoneStatus(
      baseInput({
        key_activation_date: '2026-01-01',
        life_policies_paid_in_phase1: 6,
      }),
      NOW_2026_02_15_MTY
    )
    expect(s.phase1.state).toBe('completed')
    expect(s.phase1.policies_count).toBe(6)
  })

  it('después del plazo de fase 1 con menos de 6: fase 1 vencida y fase 2 visible', () => {
    const s = getAdvisorMilestoneStatus(
      baseInput({
        key_activation_date: '2026-01-01',
        connection_date: '2026-02-01',
        life_policies_paid_in_phase1: 2,
        life_policies_cumulative_phase2: 2,
      }),
      NOW_2026_06_10_MTY
    )
    expect(s.phase1.state).toBe('overdue')
    expect(s.current_phase).toBe(2)
  })

  it('fase 2 completada con 12 acumuladas: done', () => {
    const s = getAdvisorMilestoneStatus(
      baseInput({
        key_activation_date: '2026-01-01',
        connection_date: '2026-02-01',
        life_policies_paid_in_phase1: 6,
        life_policies_cumulative_phase2: 12,
      }),
      NOW_2026_02_15_MTY
    )
    expect(s.phase2.state).toBe('completed')
    expect(s.phase2.policies_count).toBe(12)
    expect(s.phase2.policies_target).toBe(PHASE2_POLICIES_TARGET)
    expect(s.current_phase).toBe('done')
  })

  it('conexión anterior al día 90 desde clave: fase 2 puede estar en curso con acumulado', () => {
    const s = getAdvisorMilestoneStatus(
      baseInput({
        key_activation_date: '2026-01-01',
        connection_date: '2026-01-15',
        life_policies_paid_in_phase1: 4,
        life_policies_cumulative_phase2: 4,
      }),
      NOW_2026_02_15_MTY
    )
    expect(s.phase1.state).not.toBe('completed')
    expect(s.phase2.start_ymd).toBe('2026-01-15')
    expect(s.current_phase).toBe(1)
  })
})
