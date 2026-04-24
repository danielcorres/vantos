import type { StageSlug } from '../productivity/types/productivity.types'

/** Prospección y conversión temprana (metas OKR semanales por etapa). */
export const PIPELINE_PHASE_1_SLUGS: StageSlug[] = [
  'contactos_nuevos',
  'citas_agendadas',
  'casos_abiertos',
]

/** Cierre e ingreso (metas OKR semanales por etapa). */
export const PIPELINE_PHASE_2_SLUGS: StageSlug[] = [
  'citas_cierre',
  'solicitudes_ingresadas',
  'casos_ganados',
]
