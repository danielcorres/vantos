/**
 * Etapas que el Pipeline NO muestra (separación Pipeline ↔ Calendario).
 * Leads en estas etapas no aparecen en tabla/kanban; no hay columnas ni opción "Mover etapa".
 */
export const PIPELINE_HIDDEN_STAGE_SLUGS = new Set<string>(['citas_agendadas', 'citas_cierre'])

export function isPipelineHiddenStageSlug(slug: string): boolean {
  return PIPELINE_HIDDEN_STAGE_SLUGS.has(slug)
}

export function getVisiblePipelineStages<T extends { slug?: string | null }>(stages: T[]): T[] {
  return stages.filter((s) => s.slug != null && !PIPELINE_HIDDEN_STAGE_SLUGS.has(s.slug))
}
