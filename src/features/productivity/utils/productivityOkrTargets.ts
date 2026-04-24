import type { WeeklyMinimumTargetsMap } from '../../../modules/okr/dashboard/weeklyMinimumTargets'
import type { StageSlug } from '../types/productivity.types'
import { STAGE_SLUGS_ORDER } from '../types/productivity.types'

/**
 * Mínimo OKR por slug de etapa para la vista Productividad (conteos de entradas vs meta).
 * `casos_ganados` usa `policies_paid` (conteo), no prima en MXN.
 */
function okrTargetForProductivitySlug(
  slug: StageSlug,
  targets: WeeklyMinimumTargetsMap
): number | undefined {
  switch (slug) {
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
      return targets.policies_paid
    default:
      return undefined
  }
}

/** Mapa slug → meta entera para barras (0 si no hay valor). */
export function buildProductivityTargetsFromOkr(
  targets: WeeklyMinimumTargetsMap
): Record<StageSlug, number> {
  const out = {} as Record<StageSlug, number>
  for (const slug of STAGE_SLUGS_ORDER) {
    const n = okrTargetForProductivitySlug(slug, targets)
    out[slug] = n != null && Number.isFinite(n) ? Math.floor(n) : 0
  }
  return out
}
