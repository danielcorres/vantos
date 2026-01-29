export type PipelineKpisToday = {
  moves_today: number
  leads_created_today: number
}

export type PipelineFunnelRow = {
  stage_id: string
  stage_name: string
  stage_position: number
  leads_count: number
}

export type PipelineDurationRow = {
  stage_id: string
  stage_name: string
  stage_position: number
  samples_30d: number
  avg_seconds_30d: number
  median_seconds_30d: number
  p90_seconds_30d: number
}

export type PipelineTransitionRow = {
  from_stage_id: string
  from_stage_name: string
  from_stage_position: number
  to_stage_id: string
  to_stage_name: string
  to_stage_position: number
  moves_30d: number
}

export type StuckLeadRow = {
  lead_id: string
  full_name: string
  phone: string | null
  email: string | null
  source: string | null
  stage_id: string
  stage_name: string
  stage_position: number
  days_in_stage: number
  stage_changed_at: string
  created_at: string
}

/** Fila de la view pipeline_kpi_close_to_won: días desde última cita Cierre (completed) hasta ganado */
export type CloseToWonRow = {
  lead_id: string
  owner_user_id: string
  presentation_at: string
  won_at: string
  days_to_won: number
}

export type CloseToWonKpi = {
  avgDays: number | null
  count: number
  rows: CloseToWonRow[]
}
