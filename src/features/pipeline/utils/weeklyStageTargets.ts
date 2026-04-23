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
      return targets.written_premium_weekly_mxn
    default:
      return undefined
  }
}

/** Etapa final: meta en MXN; no comparar conteo de leads con ese número. */
export function pipelineTargetIsWeeklyPremiumMxn(slug: string): boolean {
  return slug === 'casos_ganados'
}

/** Texto para UI (hub, Kanban): última etapa en moneda MXN. */
export function formatPipelineWeeklyTargetDisplay(slug: string, value: number): string {
  if (pipelineTargetIsWeeklyPremiumMxn(slug)) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(value)
  }
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
