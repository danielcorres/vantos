import type { Ramo } from './policies.types'

/** Aseguradora única operada en este flujo. */
export const DEFAULT_INSURER = 'Seguros Monterrey NYL'

/** Ramos disponibles en captura y filtros (Vida y GMM). */
export const FORM_RAMOS: readonly Ramo[] = ['vida', 'gmm']

export function isFormRamo(r: Ramo): boolean {
  return (FORM_RAMOS as readonly string[]).includes(r)
}
