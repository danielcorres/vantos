import type { StageSlug } from '../../productivity/types/productivity.types'
import type { WeeklyMinimumTargetsMap } from '../../../modules/okr/dashboard/weeklyMinimumTargets'

/** Mapeo embudo Kinderbrothers: slug de etapa → meta semanal (okr_weekly_minimum_targets). */
export function weeklyTargetForPipelineSlug(
  slug: string,
  targets: WeeklyMinimumTargetsMap
): number | undefined {
  switch (slug as StageSlug) {
    case 'contactos_nuevos':
      return targets.calls
    case 'citas_agendadas':
      return targets.meetings_set
    case 'casos_abiertos':
      return targets.meetings_held
    case 'citas_cierre':
      return targets.proposals_presented
    case 'solicitudes_ingresadas':
      return targets.applications_submitted
    case 'casos_ganados':
      /** Meta semanal en OKR: pólizas pagadas (conteo), p. ej. 1/semana — no prima en MXN. */
      return targets.policies_paid
    default:
      return undefined
  }
}

/** Texto para meta numérica en UI del embudo semanal. */
export function formatPipelineWeeklyTargetDisplay(_slug: string, value: number): string {
  return String(value)
}

/** Metas por `stage_id` según el slug de cada etapa. */
export function buildStageTargetCountMap(
  stages: { id: string; slug: string }[],
  targets: WeeklyMinimumTargetsMap
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const s of stages) {
    const n = weeklyTargetForPipelineSlug(s.slug, targets)
    if (n != null && Number.isFinite(n)) out[s.id] = n
  }
  return out
}
