import { supabase } from '../../lib/supabaseClient'

export type PipelineStage = {
  id: string
  name: string
  position: number
  is_active: boolean
}

export type Lead = {
  id: string
  owner_user_id: string
  full_name: string
  phone: string | null
  email: string | null
  source: string | null
  notes: string | null
  stage_id: string
  stage_changed_at: string
  created_at: string
  updated_at: string
  // SLA fields (may come from view or be null)
  sla_status?: 'breach' | 'warn' | 'ok' | 'none' | null
  sla_due_at?: string | null
  sla_days_left?: number | null
  sla_days_remaining?: number | null
  days_in_stage?: number | null
}

export type CreateLeadInput = {
  full_name: string
  phone?: string
  email?: string
  source?: string
  notes?: string
  stage_id: string
}

export const pipelineApi = {
  async getStages(): Promise<PipelineStage[]> {
    const { data, error } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('is_active', true)
      .order('position', { ascending: true })

    if (error) throw error
    return data || []
  },

  async getLeads(): Promise<Lead[]> {
    // TODO: When backend provides SLA data directly in leads query or via view join,
    // extend this to fetch from enriched source. For now, fetch from leads table
    // and adapter in frontend will handle SLA fields (null if not available).
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    
    // Normalize and extend with SLA fields (adapter: set to null if not in response)
    // These fields may come from v_lead_sla_alerts view in the future
    return (data || []).map((lead) => ({
      ...lead,
      // Adapter: Extract SLA fields if they exist in response, otherwise null
      sla_status: (lead as Record<string, unknown>).sla_status as Lead['sla_status'] ?? null,
      sla_due_at: ((lead as Record<string, unknown>).sla_due_at as string | null) ?? null,
      sla_days_left: ((lead as Record<string, unknown>).sla_days_left as number | null) ?? null,
      sla_days_remaining: ((lead as Record<string, unknown>).sla_days_remaining as number | null) ?? null,
      days_in_stage: ((lead as Record<string, unknown>).days_in_stage as number | null) ?? null,
    }))
  },

  async createLead(input: CreateLeadInput): Promise<Lead> {
    const { data, error } = await supabase
      .from('leads')
      .insert({
        full_name: input.full_name,
        phone: input.phone || null,
        email: input.email || null,
        source: input.source || null,
        notes: input.notes || null,
        stage_id: input.stage_id,
      })
      .select()
      .single()

    if (error) throw error
    return data
  },

  async moveLeadStage(
    leadId: string,
    toStageId: string,
    idempotencyKey: string
  ): Promise<void> {
    const { error } = await supabase.rpc('move_lead_stage', {
      p_lead_id: leadId,
      p_to_stage_id: toStageId,
      p_idempotency_key: idempotencyKey,
    })

    if (error) throw error
  },

  async deleteLead(leadId: string): Promise<void> {
    const { error } = await supabase.from('leads').delete().eq('id', leadId)

    if (error) throw error
  },
}
