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
