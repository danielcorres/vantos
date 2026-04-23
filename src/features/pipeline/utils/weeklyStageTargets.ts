import type { StageSlug } from '../../productivity/types/productivity.types'
import type { WeeklyMinimumTargetsMap } from '../../../modules/okr/dashboard/weeklyMinimumTargets'

/** Mapeo plan Hub Semanal: slug de etapa → meta semanal (okr_weekly_minimum_targets). */
export function weeklyTargetForPipelineSlug(
  slug: string,
  targets: WeeklyMinimumTargetsMap
): number | undefined {
  switch (slug as StageSlug) {
    case 'contactos_nuevos':
      return targets.meetings_set
    case 'citas_agendadas':
      return targets.meetings_held
    case 'casos_abiertos':
      return targets.proposals_presented
    case 'citas_cierre': {
      const base = targets.applications_submitted
      return base != null ? base * 4 : undefined
    }
    case 'solicitudes_ingresadas':
      return targets.applications_submitted
    default:
      return undefined
  }
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
