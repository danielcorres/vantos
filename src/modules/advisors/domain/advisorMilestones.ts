/**
 * Dominio puro de hitos para asesores.
 *
 * Fase 1: Firma de contrato
 *   - start = connection_date
 *   - duración = 90 días
 *   - completed cuando contract_signed_at no es null
 *
 * Fase 2: 12 pólizas de vida pagadas
 *   - start = contract_signed_at
 *   - duración = 90 días
 *   - completed cuando policies_count >= 12
 *
 * Aplica únicamente a advisor_status = 'asesor_12_meses'.
 *
 * No usa red ni Supabase. Calcula días en timezone America/Monterrey
 * apoyándose en utilidades de src/shared/utils/dates.ts.
 */

import { TZ_MTY, formatYmdInTz, addDaysYmd, daysBetweenYmd, timestampToYmdInTz } from '../../../shared/utils/dates'

export type AdvisorStatus = 'asesor_12_meses' | 'nueva_generacion' | 'consolidado'

export type MilestoneState =
  | 'not_started'
  | 'in_progress'
  | 'at_risk'
  | 'overdue'
  | 'completed'

export const PHASE_DURATION_DAYS = 90
export const AT_RISK_THRESHOLD_DAYS = 15
export const PHASE2_POLICIES_TARGET = 12

export interface AdvisorMilestoneInput {
  advisor_status: AdvisorStatus | string | null
  connection_date: string | null       // 'YYYY-MM-DD'
  contract_signed_at: string | null    // ISO timestamp
  life_policies_paid_in_phase2: number // conteo inyectado por la capa de datos
}

export interface PhaseStatus {
  state: MilestoneState
  start_ymd: string | null
  deadline_ymd: string | null
  days_remaining: number | null
  days_overdue: number | null
}

export interface Phase2Status extends PhaseStatus {
  policies_count: number
  policies_target: typeof PHASE2_POLICIES_TARGET
  progress_ratio: number
}

export interface AdvisorMilestoneStatus {
  applies: boolean
  phase1: PhaseStatus
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
 * Calcula el estado de los hitos del asesor.
 *
 * @param input Datos mínimos del asesor (perfil + conteo de pólizas)
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
      phase1: EMPTY_PHASE,
      phase2: EMPTY_PHASE2,
      current_phase: 1,
    }
  }

  // ---------------- FASE 1 ----------------
  const phase1 = computePhase1(input.connection_date, input.contract_signed_at, todayYmd)

  // ---------------- FASE 2 ----------------
  const phase2 = computePhase2(
    input.contract_signed_at,
    input.life_policies_paid_in_phase2,
    todayYmd,
    phase1.state
  )

  const current_phase: 1 | 2 | 'done' =
    phase2.state === 'completed'
      ? 'done'
      : phase1.state === 'completed'
        ? 2
        : 1

  return {
    applies: true,
    phase1,
    phase2,
    current_phase,
  }
}

function computePhase1(
  connectionDate: string | null,
  contractSignedAt: string | null,
  todayYmd: string
): PhaseStatus {
  if (contractSignedAt) {
    const startYmd = connectionDate
    const deadlineYmd = startYmd ? addDaysYmd(startYmd, PHASE_DURATION_DAYS) : null
    return {
      state: 'completed',
      start_ymd: startYmd,
      deadline_ymd: deadlineYmd,
      days_remaining: null,
      days_overdue: null,
    }
  }

  if (!connectionDate) {
    return EMPTY_PHASE
  }

  const deadlineYmd = addDaysYmd(connectionDate, PHASE_DURATION_DAYS)
  const diff = daysBetweenYmd(todayYmd, deadlineYmd) // deadline - today

  if (diff < 0) {
    return {
      state: 'overdue',
      start_ymd: connectionDate,
      deadline_ymd: deadlineYmd,
      days_remaining: 0,
      days_overdue: Math.abs(diff),
    }
  }

  const state: MilestoneState = diff <= AT_RISK_THRESHOLD_DAYS ? 'at_risk' : 'in_progress'

  return {
    state,
    start_ymd: connectionDate,
    deadline_ymd: deadlineYmd,
    days_remaining: diff,
    days_overdue: 0,
  }
}

function computePhase2(
  contractSignedAt: string | null,
  policiesCount: number,
  todayYmd: string,
  phase1State: MilestoneState
): Phase2Status {
  const count = Math.max(0, Math.floor(policiesCount || 0))
  const progress_ratio = Math.min(count / PHASE2_POLICIES_TARGET, 1)

  if (!contractSignedAt) {
    // La Fase 2 depende de haber completado la Fase 1
    return {
      ...EMPTY_PHASE2,
      state: phase1State === 'completed' ? 'in_progress' : 'not_started',
      policies_count: count,
      progress_ratio,
    }
  }

  const startYmd = timestampToYmdInTz(contractSignedAt, TZ_MTY)
  const deadlineYmd = addDaysYmd(startYmd, PHASE_DURATION_DAYS)

  if (count >= PHASE2_POLICIES_TARGET) {
    return {
      state: 'completed',
      start_ymd: startYmd,
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
      start_ymd: startYmd,
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
    start_ymd: startYmd,
    deadline_ymd: deadlineYmd,
    days_remaining: diff,
    days_overdue: 0,
    policies_count: count,
    policies_target: PHASE2_POLICIES_TARGET,
    progress_ratio,
  }
}

/**
 * Rango [from, to) en formato YYYY-MM-DD de la ventana de Fase 2
 * correspondiente a `contract_signed_at`. Útil para queries/RPC.
 */
export function getPhase2Window(contractSignedAt: string | null): {
  from_ymd: string
  to_ymd: string
} | null {
  if (!contractSignedAt) return null
  const from = timestampToYmdInTz(contractSignedAt, TZ_MTY)
  // `to` es exclusivo: start + 90 + 1 día para incluir el último día completo
  // (RPC usa `paid_at < p_to`, así que +91 garantiza incluir el día 90).
  const to = addDaysYmd(from, PHASE_DURATION_DAYS + 1)
  return { from_ymd: from, to_ymd: to }
}
