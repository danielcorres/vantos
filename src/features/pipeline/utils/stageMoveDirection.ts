import type { PipelineStage } from '../pipeline.api'

export type StageForOrder = { id: string; position: number; name?: string; is_active?: boolean }

function orderedActiveStages(stages: StageForOrder[]): StageForOrder[] {
  return [...stages]
    .filter((s) => s.is_active !== false)
    .sort((a, b) => a.position - b.position)
}

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

/** Retroceso permitido: solo a la etapa activa inmediatamente anterior en el orden por `position`. */
export function isImmediateBackwardStageMove(
  fromStageId: string,
  toStageId: string,
  stages: StageForOrder[]
): boolean {
  const ordered = orderedActiveStages(stages)
  const iFrom = ordered.findIndex((s) => s.id === fromStageId)
  const iTo = ordered.findIndex((s) => s.id === toStageId)
  if (iFrom <= 0 || iTo < 0) return false
  return iTo === iFrom - 1
}

export function getImmediatePreviousStage(
  fromStageId: string,
  stages: StageForOrder[]
): StageForOrder | null {
  const ordered = orderedActiveStages(stages)
  const iFrom = ordered.findIndex((s) => s.id === fromStageId)
  if (iFrom <= 0) return null
  return ordered[iFrom - 1] ?? null
}

/** Mensaje cuando el usuario intenta saltar varias etapas hacia atrás. */
export function getMultiStepBackwardBlockedMessage(fromStageId: string, stages: StageForOrder[]): string {
  const prev = getImmediatePreviousStage(fromStageId, stages)
  if (prev?.name) {
    return `Solo puedes retroceder una etapa a la vez. Primero mueve el lead a «${prev.name}».`
  }
  if (prev) {
    return 'Solo puedes retroceder una etapa a la vez. Primero mueve el lead a la etapa inmediatamente anterior.'
  }
  return 'No puedes retroceder más desde esta etapa.'
}
