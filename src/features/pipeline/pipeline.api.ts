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
  // Seguimiento fields
  last_contact_at: string | null
  next_follow_up_at: string | null
}

export type CreateLeadInput = {
  full_name: string
  phone?: string
  email?: string
  source?: string
  notes?: string
  stage_id: string
  next_follow_up_at?: string
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
    
    // Normalize and extend with seguimiento fields
    return (data || []).map((lead) => ({
      ...lead,
      last_contact_at: ((lead as Record<string, unknown>).last_contact_at as string | null) ?? null,
      next_follow_up_at: ((lead as Record<string, unknown>).next_follow_up_at as string | null) ?? null,
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
        next_follow_up_at: input.next_follow_up_at || null,
      })
      .select()
      .single()

    if (error) throw error
    return {
      ...data,
      last_contact_at: data.last_contact_at ?? null,
      next_follow_up_at: data.next_follow_up_at ?? null,
    }
  },

  async updateLead(leadId: string, updates: {
    full_name?: string
    phone?: string | null
    email?: string | null
    source?: string | null
    notes?: string | null
    stage_id?: string
    last_contact_at?: string | null
    next_follow_up_at?: string | null
  }): Promise<Lead> {
    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', leadId)
      .select()
      .single()

    if (error) throw error
    return {
      ...data,
      last_contact_at: data.last_contact_at ?? null,
      next_follow_up_at: data.next_follow_up_at ?? null,
    }
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
