import { supabase } from '../../../lib/supabaseClient'
import type {
  PipelineKpisToday,
  PipelineFunnelRow,
  PipelineDurationRow,
  PipelineTransitionRow,
  StuckLeadRow,
  CloseToWonKpi,
  CloseToWonRow,
  MonthlyProductionCounts,
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
   * Conteos por condición del lead (activos no archivados).
   */
  async getConditionCounts(): Promise<{ withCondition: number; negative: number }> {
    const [withRes, negRes] = await Promise.all([
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .is('archived_at', null)
        .not('lead_condition', 'is', null),
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .is('archived_at', null)
        .in('lead_condition', ['budget', 'unreachable']),
    ])
    return {
      withCondition: withRes.count ?? 0,
      negative: negRes.count ?? 0,
    }
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

  /**
   * Resultados del mes: conteos de entradas a casos_abiertos, citas_cierre, casos_ganados
   * en el mes (lead_stage_history, occurred_at/moved_at en mes).
   */
  async getMonthlyProductionCounts(month?: Date): Promise<MonthlyProductionCounts> {
    const d = month ?? new Date()
    const year = d.getFullYear()
    const monthNum = d.getMonth() + 1
    const { data, error } = await supabase.rpc('get_monthly_production_counts', {
      p_year: year,
      p_month: monthNum,
    })
    if (error) throw error
    const rows = (data ?? []) as { slug: string; count: number }[]
    const map: Record<string, number> = { casos_abiertos: 0, citas_cierre: 0, casos_ganados: 0 }
    for (const r of rows) {
      if (r.slug in map) map[r.slug] = r.count
    }
    return {
      casos_abiertos: map.casos_abiertos,
      citas_cierre: map.citas_cierre,
      casos_ganados: map.casos_ganados,
    }
  },
}
