/**
 * Productividad semanal: entradas por etapa (RPC get_weekly_pipeline_entries).
 * Embudo Pipeline V3 (orden de etapas).
 */

export type StageSlug =
  | 'contactos_nuevos'
  | 'citas_agendadas'
  | 'casos_abiertos'
  | 'citas_cierre'
  | 'solicitudes_ingresadas'
  | 'casos_ganados'

export const STAGE_SLUGS_ORDER: StageSlug[] = [
  'contactos_nuevos',
  'citas_agendadas',
  'casos_abiertos',
  'citas_cierre',
  'solicitudes_ingresadas',
  'casos_ganados',
]

export interface WeeklyProductivity {
  weekStartYmd: string
  weekEndExclusiveYmd: string
  counts: Record<StageSlug, number>
}

/** Lead que entró a una etapa en la semana (drill-down). */
export interface WeeklyEntryLead {
  lead_id: string
  lead_name: string | null
  moved_at: string
  next_follow_up_at?: string | null
  source?: string | null
}
