import type { PipelineStage } from '../pipeline.api'

/** Retroceso = etapa destino con menor `position` que la actual (embudo ordenado por position asc). */
export function isBackwardStageMove(
  fromStageId: string,
  toStageId: string,
  stages: PipelineStage[]
): boolean {
  const from = stages.find((s) => s.id === fromStageId)
  const to = stages.find((s) => s.id === toStageId)
  if (!from || !to) return false
  return to.position < from.position
}
