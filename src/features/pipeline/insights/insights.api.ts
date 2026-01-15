import { supabase } from '../../../lib/supabaseClient'
import type {
  PipelineKpisToday,
  PipelineFunnelRow,
  PipelineDurationRow,
  PipelineTransitionRow,
  StuckLeadRow,
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
}
