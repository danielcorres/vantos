import { supabase } from '../../../lib/supabaseClient'
import type {
  PipelineKpisToday,
  PipelineFunnelRow,
  PipelineDurationRow,
  PipelineTransitionRow,
  StuckLeadRow,
  CloseToWonKpi,
  CloseToWonRow,
} from './insights.types'

export const insightsApi = {
  async getKpisToday(): Promise<PipelineKpisToday> {
    const { data, error } = await supabase
      .from('pipeline_kpis_today')
      .select('*')
      .single()

    if (error) throw error
    return data
  },

  async getFunnelCurrent(): Promise<PipelineFunnelRow[]> {
    const { data, error } = await supabase
      .from('pipeline_funnel_current')
      .select('*')
      .order('stage_position', { ascending: true })

    if (error) throw error
    return data || []
  },

  async getDurationStats30d(): Promise<PipelineDurationRow[]> {
    const { data, error } = await supabase
      .from('pipeline_stage_duration_stats_30d')
      .select('*')
      .order('stage_position', { ascending: true })

    if (error) throw error
    return data || []
  },

  async getTransitions30d(): Promise<PipelineTransitionRow[]> {
    const { data, error } = await supabase
      .from('pipeline_transitions_30d')
      .select('*')

    if (error) throw error
    // Sort by from_stage_position, then to_stage_position
    return (data || []).sort((a, b) => {
      if (a.from_stage_position !== b.from_stage_position) {
        return a.from_stage_position - b.from_stage_position
      }
      return a.to_stage_position - b.to_stage_position
    })
  },

  async getStuckLeads(days: number): Promise<StuckLeadRow[]> {
    const { data, error } = await supabase.rpc('pipeline_stuck_leads', {
      p_days: days,
    })

    if (error) throw error
    return data || []
  },

  /**
   * KPI: días desde última cita Cierre (completed) hasta ganado.
   * Filtro opcional por rango de won_at (ISO).
   */
  async getCloseToWonKpi(params?: { from?: string; to?: string }): Promise<CloseToWonKpi> {
    let query = supabase
      .from('pipeline_kpi_close_to_won')
      .select('lead_id, owner_user_id, presentation_at, won_at, days_to_won')

    if (params?.from) query = query.gte('won_at', params.from)
    if (params?.to) query = query.lte('won_at', params.to)

    const { data, error } = await query

    if (error) throw error
    const rows = (data ?? []) as CloseToWonRow[]

    if (rows.length === 0) {
      return { avgDays: null, count: 0, rows: [] }
    }

    const sum = rows.reduce((acc, r) => acc + r.days_to_won, 0)
    const avgDays = Math.round((sum / rows.length) * 10) / 10

    return { avgDays, count: rows.length, rows }
  },
}
