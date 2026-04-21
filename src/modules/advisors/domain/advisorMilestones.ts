/**
 * Dominio puro de hitos para asesores.
 *
 * Fase 1: 6 pólizas de vida en 90 días desde fecha de alta de clave (key_activation_date).
 *   - Conteo inyectado: pólizas con paid_at en [key_activation, key_activation + 90d).
 *   - Incluye precontrato si las pólizas caen en esa ventana.
 *
 * Fase 2: 12 pólizas acumuladas hasta el fin de los 90 días posteriores a connection_date.
 *   - Conteo inyectado: paid_at >= key_activation y paid_at < connection_date + 91 días.
 *   - Countdown en UI: 90 días desde connection_date.
 *
 * Aplica únicamente a advisor_status = 'asesor_12_meses'.
 *
 * No usa red ni Supabase. Calcula días en timezone America/Monterrey
 * apoyándose en utilidades de src/shared/utils/dates.ts.
 */

import { TZ_MTY, formatYmdInTz, addDaysYmd, daysBetweenYmd } from '../../../shared/utils/dates'

export type AdvisorStatus = 'asesor_12_meses' | 'nueva_generacion' | 'consolidado'

export type MilestoneState =
  | 'not_started'
  | 'in_progress'
  | 'at_risk'
  | 'overdue'
  | 'completed'

export const PHASE_DURATION_DAYS = 90
export const AT_RISK_THRESHOLD_DAYS = 15
export const PHASE1_POLICIES_TARGET = 6
export const PHASE2_POLICIES_TARGET = 12

export interface AdvisorMilestoneInput {
  advisor_status: AdvisorStatus | string | null
  /** YYYY-MM-DD; inicio ventana 6 pólizas */
  key_activation_date: string | null
  connection_date: string | null
  /** Pólizas en [key_activation, key_activation + 91d) */
  life_policies_paid_in_phase1: number
  /** Acumulado desde key_activation hasta fin de 90d post-conexión (exclusivo en to) */
  life_policies_cumulative_phase2: number
}

export interface PhaseStatus {
  state: MilestoneState
  start_ymd: string | null
  deadline_ymd: string | null
  days_remaining: number | null
  days_overdue: number | null
}

export interface Phase1Status extends PhaseStatus {
  policies_count: number
  policies_target: typeof PHASE1_POLICIES_TARGET
  progress_ratio: number
}

export interface Phase2Status extends PhaseStatus {
  policies_count: number
  policies_target: typeof PHASE2_POLICIES_TARGET
  progress_ratio: number
}

export interface AdvisorMilestoneStatus {
  applies: boolean
  phase1: Phase1Status
  phase2: Phase2Status
  current_phase: 1 | 2 | 'done'
}

const EMPTY_PHASE: PhaseStatus = {
  state: 'not_started',
  start_ymd: null,
  deadline_ymd: null,
  days_remaining: null,
  days_overdue: null,
}

const EMPTY_PHASE1: Phase1Status = {
  ...EMPTY_PHASE,
  policies_count: 0,
  policies_target: PHASE1_POLICIES_TARGET,
  progress_ratio: 0,
}

const EMPTY_PHASE2: Phase2Status = {
  ...EMPTY_PHASE,
  policies_count: 0,
  policies_target: PHASE2_POLICIES_TARGET,
  progress_ratio: 0,
}

export function isAdvisorStatus(value: unknown): value is AdvisorStatus {
  return (
    value === 'asesor_12_meses' ||
    value === 'nueva_generacion' ||
    value === 'consolidado'
  )
}

/**
 * Ventana [from, to) para contar pólizas hacia la meta de Fase 1 (6 en 90 días).
 */
export function getPhase1PolicyWindow(keyActivationDate: string | null): {
  from_ymd: string
  to_ymd: string
} | null {
  if (!keyActivationDate) return null
  const from = keyActivationDate
  const to = addDaysYmd(from, PHASE_DURATION_DAYS + 1)
  return { from_ymd: from, to_ymd: to }
}

/**
 * Ventana [from, to) para conteo acumulativo hacia la meta de Fase 2 (12 pólizas).
 * Desde alta de clave hasta el día siguiente al último día del periodo de 90 días post-conexión.
 */
export function getPhase2CumulativeWindow(
  keyActivationDate: string | null,
  connectionDate: string | null
): { from_ymd: string; to_ymd: string } | null {
  if (!keyActivationDate || !connectionDate) return null
  const from = keyActivationDate
  const to = addDaysYmd(connectionDate, PHASE_DURATION_DAYS + 1)
  return { from_ymd: from, to_ymd: to }
}

/**
 * Calcula el estado de los hitos del asesor.
 *
 * @param input Datos mínimos del asesor (perfil + conteos de pólizas)
 * @param now Fecha/hora actual (inyectable para tests). Default: new Date()
 */
export function getAdvisorMilestoneStatus(
  input: AdvisorMilestoneInput,
  now: Date = new Date()
): AdvisorMilestoneStatus {
  const todayYmd = formatYmdInTz(now, TZ_MTY)

  const applies = input.advisor_status === 'asesor_12_meses'

  if (!applies) {
    return {
      applies: false,
      phase1: EMPTY_PHASE1,
      phase2: EMPTY_PHASE2,
      current_phase: 1,
    }
  }

  const phase1 = computePhase1(
    input.key_activation_date,
    input.life_policies_paid_in_phase1,
    todayYmd
  )

  const phase2 = computePhase2(
    input.key_activation_date,
    input.connection_date,
    input.life_policies_cumulative_phase2,
    todayYmd
  )

  const phase1Closed = phase1.state === 'completed' || phase1.state === 'overdue'

  const current_phase: 1 | 2 | 'done' =
    phase2.state === 'completed' ? 'done' : !phase1Closed ? 1 : 2

  return {
    applies: true,
    phase1,
    phase2,
    current_phase,
  }
}

function computePhase1(
  keyActivation: string | null,
  policiesCount: number,
  todayYmd: string
): Phase1Status {
  const count = Math.max(0, Math.floor(policiesCount || 0))
  const progress_ratio = Math.min(count / PHASE1_POLICIES_TARGET, 1)

  if (!keyActivation) {
    return {
      ...EMPTY_PHASE1,
      policies_count: count,
      progress_ratio,
    }
  }

  const deadlineYmd = addDaysYmd(keyActivation, PHASE_DURATION_DAYS)

  if (count >= PHASE1_POLICIES_TARGET) {
    return {
      state: 'completed',
      start_ymd: keyActivation,
      deadline_ymd: deadlineYmd,
      days_remaining: null,
      days_overdue: null,
      policies_count: count,
      policies_target: PHASE1_POLICIES_TARGET,
      progress_ratio: 1,
    }
  }

  const diff = daysBetweenYmd(todayYmd, deadlineYmd)

  if (diff < 0) {
    return {
      state: 'overdue',
      start_ymd: keyActivation,
      deadline_ymd: deadlineYmd,
      days_remaining: 0,
      days_overdue: Math.abs(diff),
      policies_count: count,
      policies_target: PHASE1_POLICIES_TARGET,
      progress_ratio,
    }
  }

  const state: MilestoneState = diff <= AT_RISK_THRESHOLD_DAYS ? 'at_risk' : 'in_progress'

  return {
    state,
    start_ymd: keyActivation,
    deadline_ymd: deadlineYmd,
    days_remaining: diff,
    days_overdue: 0,
    policies_count: count,
    policies_target: PHASE1_POLICIES_TARGET,
    progress_ratio,
  }
}

function computePhase2(
  keyActivation: string | null,
  connectionDate: string | null,
  policiesCumulative: number,
  todayYmd: string
): Phase2Status {
  const count = Math.max(0, Math.floor(policiesCumulative || 0))
  const progress_ratio = Math.min(count / PHASE2_POLICIES_TARGET, 1)

  if (!connectionDate || !keyActivation) {
    return {
      ...EMPTY_PHASE2,
      state: 'not_started',
      policies_count: count,
      progress_ratio,
    }
  }

  const deadlineYmd = addDaysYmd(connectionDate, PHASE_DURATION_DAYS)

  if (count >= PHASE2_POLICIES_TARGET) {
    return {
      state: 'completed',
      start_ymd: connectionDate,
      deadline_ymd: deadlineYmd,
      days_remaining: null,
      days_overdue: null,
      policies_count: count,
      policies_target: PHASE2_POLICIES_TARGET,
      progress_ratio: 1,
    }
  }

  const diff = daysBetweenYmd(todayYmd, deadlineYmd)

  if (diff < 0) {
    return {
      state: 'overdue',
      start_ymd: connectionDate,
      deadline_ymd: deadlineYmd,
      days_remaining: 0,
      days_overdue: Math.abs(diff),
      policies_count: count,
      policies_target: PHASE2_POLICIES_TARGET,
      progress_ratio,
    }
  }

  const state: MilestoneState = diff <= AT_RISK_THRESHOLD_DAYS ? 'at_risk' : 'in_progress'

  return {
    state,
    start_ymd: connectionDate,
    deadline_ymd: deadlineYmd,
    days_remaining: diff,
    days_overdue: 0,
    policies_count: count,
    policies_target: PHASE2_POLICIES_TARGET,
    progress_ratio,
  }
}
