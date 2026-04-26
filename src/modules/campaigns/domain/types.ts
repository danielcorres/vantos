// ─── Tipos de dominio del módulo Campañas ─────────────────────────────────────

export type CampaignType = 'monthly' | 'new_advisor_path' | 'multi_track' | 'ranking'

export type EvaluationPeriodType = 'monthly' | 'quarterly' | 'semester' | 'annual' | 'custom'

export type WinConditionType = 'threshold' | 'ranking_position' | 'hybrid'

export type RankingScope = 'global' | 'zone' | 'team' | 'manager_team'

export type RewardType = 'cash' | 'physical' | 'trip' | 'discount' | 'recognition' | 'event' | 'other'

export type AwardStatus =
  | 'projected'
  | 'eligible'
  | 'pending_validation'
  | 'earned'
  | 'confirmed'
  | 'delivered'
  | 'lost'
  | 'recovered'
  | 'cancelled'

export type ImportStatus = 'running' | 'completed' | 'completed_with_warnings' | 'error'

// ─── Catálogo ─────────────────────────────────────────────────────────────────

export interface Campaign {
  id: string
  slug: string
  name: string
  description: string | null
  metric_type: string
  unit_label: string
  color: string | null
  sort_order: number
  is_active: boolean
  starts_at: string | null
  ends_at: string | null
  campaign_type: CampaignType
  duration_months: number | null
  eligibility_basis: string | null
  rules_summary: string | null
  eligibility_rules_summary: string | null
  rewards_are_cumulative: boolean
  max_rewards_per_period: number | null
  created_at: string
  updated_at: string
}

export interface CampaignTrack {
  id: string
  campaign_id: string
  slug: string
  name: string
  description: string | null
  metric_type: string | null
  unit_label: string | null
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CampaignLevel {
  id: string
  campaign_id: string
  track_id: string | null
  name: string
  level_order: number
  target_value: number
  badge_label: string | null
  color: string | null
  is_active: boolean
  // Premio simple
  reward_title: string | null
  reward_description: string | null
  reward_image_url: string | null
  reward_terms: string | null
  reward_estimated_value: number | null
  reward_is_active: boolean
  // Periodo de evaluación
  evaluation_period_type: EvaluationPeriodType
  period_label: string | null
  // Condición de victoria
  win_condition_type: WinConditionType
  required_rank: number | null
  ranking_scope: RankingScope | null
  tie_breaker_metric: string | null
  // Carrera
  target_month: number | null
  requires_monthly_minimum: boolean
  monthly_minimum_description: string | null
  requires_active_group: boolean
  requires_inforce_ratio: boolean
  minimum_inforce_ratio: number | null
  requires_limra_index: boolean
  can_recover_previous_rewards: boolean
  recovery_scope: string | null
  validation_notes: string | null
  created_at: string
  updated_at: string
}

export interface CampaignLevelReward {
  id: string
  level_id: string
  title: string
  description: string | null
  reward_type: RewardType
  choice_group: string | null
  is_choice_option: boolean
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CampaignSnapshot {
  id: string
  user_id: string
  campaign_id: string
  track_id: string | null
  periodo: string
  metric_type: string
  value: number
  source_name: string | null
  source_clave_asesor: string
  import_id: string | null
  advisor_campaign_month: number | null
  source_zone: string | null
  tie_breaker_value: number | null
  created_at: string
  updated_at: string
}

export interface CampaignImport {
  id: string
  source: string
  periodo: string
  status: ImportStatus
  rows_processed: number
  rows_inserted: number
  rows_updated: number
  rows_skipped: number
  unmatched_count: number
  error_message: string | null
  triggered_by: string | null
  created_at: string
  finished_at: string | null
}

export interface CampaignImportUnmatchedRow {
  id: string
  import_id: string
  periodo: string
  clave_asesor: string
  source_name: string | null
  campaign_slug: string | null
  track_slug: string | null
  metric_type: string | null
  value: number | null
  source_zone: string | null
  tie_breaker_value: number | null
  reason: string
  created_at: string
}

export interface CampaignRewardAward {
  id: string
  user_id: string
  campaign_id: string
  track_id: string | null
  level_id: string
  selected_reward_id: string | null
  periodo: string
  value_at_award: number
  tie_breaker_value_at_award: number | null
  ranking_position_at_award: number | null
  status: AwardStatus
  status_changed_at: string | null
  status_changed_by: string | null
  awarded_at: string
  confirmed_at: string | null
  confirmed_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ─── Premio alternativo dentro de un nivel (retorno del RPC) ─────────────────

export interface DashboardRewardOption {
  id: string
  title: string
  description: string | null
  reward_type: RewardType
  choice_group: string | null
  is_choice_option: boolean
  sort_order: number
}

// ─── Datos compuestos del dashboard (retorno del RPC) ─────────────────────────

export interface DashboardLevelSummary {
  id: string
  name: string
  level_order: number
  target_value: number
  target_month: number | null
  reward_title: string | null
  reward_description: string | null
  reward_image_url: string | null
  reward_is_active: boolean
  requires_monthly_minimum: boolean
  monthly_minimum_description: string | null
  requires_active_group: boolean
  requires_inforce_ratio: boolean
  minimum_inforce_ratio: number | null
  requires_limra_index: boolean
  validation_notes: string | null
  evaluation_period_type: EvaluationPeriodType
  period_label: string | null
  /** Premios alternativos configurados para este nivel (MacBook Air, maleta TUMI, etc.) */
  reward_options: DashboardRewardOption[]
}

export interface DashboardEntry {
  snapshot_id: string
  user_id: string
  display_name: string
  advisor_code: string | null
  campaign_id: string
  track_id: string | null
  periodo: string
  metric_type: string
  value: number
  advisor_campaign_month: number | null
  source_zone: string | null
  tie_breaker_value: number | null
  ranking_position: number | null
  ranking_total: number | null
  current_level: DashboardLevelSummary | null
  next_level: DashboardLevelSummary | null
  is_max_reached: boolean
  award_status: AwardStatus | null
  selected_reward_id: string | null
}

export interface RankingEntry {
  user_id: string
  display_name: string
  value: number | null
  tie_breaker_value: number | null
  rank_pos: number
  rank_total: number
  is_current_user: boolean
}

// ─── Resultado de sync ────────────────────────────────────────────────────────

export interface SyncResult {
  ok: boolean
  import_id: string
  status: ImportStatus
  periodo: string
  rows_processed: number
  rows_inserted: number
  rows_updated: number
  rows_skipped: number
  unmatched_count: number
  error?: string
}
