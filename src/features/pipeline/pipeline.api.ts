import { supabase } from '../../lib/supabaseClient'

function normalizeLead(row: Record<string, unknown>): Lead {
  return {
    ...row,
    last_contact_at: (row.last_contact_at as string | null) ?? null,
    next_follow_up_at: (row.next_follow_up_at as string | null) ?? null,
    archived_at: (row.archived_at as string | null) ?? null,
    archived_by: (row.archived_by as string | null) ?? null,
    archive_reason: (row.archive_reason as string | null) ?? null,
    cita_realizada_at: (row.cita_realizada_at as string | null) ?? null,
    propuesta_presentada_at: (row.propuesta_presentada_at as string | null) ?? null,
    cerrado_at: (row.cerrado_at as string | null) ?? null,
    referral_name: (row.referral_name as string | null) ?? null,
  } as Lead
}

export type PipelineStage = {
  id: string
  name: string
  slug: string
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
  last_contact_at: string | null
  next_follow_up_at: string | null
  archived_at: string | null
  archived_by: string | null
  archive_reason: string | null
  cita_realizada_at: string | null
  propuesta_presentada_at: string | null
  cerrado_at: string | null
  referral_name: string | null
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

export type LeadStageHistoryRow = {
  id: string
  lead_id: string
  from_stage_id: string | null
  to_stage_id: string
  moved_at: string
  occurred_at: string | null
  idempotency_key: string
}

export const pipelineApi = {
  async getStages(): Promise<PipelineStage[]> {
    const { data, error } = await supabase
      .from('pipeline_stages')
      .select('id, name, slug, position, is_active')
      .eq('is_active', true)
      .order('position', { ascending: true })

    if (error) throw error
    return (data || []) as PipelineStage[]
  },

  /**
   * Archivado es solo manual: leads.archived_at IS NOT NULL.
   * Activos = archived_at IS NULL (incluye cerrados).
   * Archivados = archived_at IS NOT NULL.
   */
  async getLeads(mode: 'activos' | 'archivados'): Promise<Lead[]> {
    if (mode === 'activos') {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .is('archived_at', null)
      if (error) throw error
      return (data || []).map(normalizeLead)
    }

    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .not('archived_at', 'is', null)
    if (error) throw error
    return (data || []).map(normalizeLead)
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
    return normalizeLead(data as Record<string, unknown>)
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
    archived_at?: string | null
    archived_by?: string | null
    archive_reason?: string | null
    cita_realizada_at?: string | null
    propuesta_presentada_at?: string | null
    cerrado_at?: string | null
    referral_name?: string | null
  }): Promise<Lead> {
    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', leadId)
      .select()
      .single()

    if (error) throw error
    return normalizeLead(data as Record<string, unknown>)
  },

  /** Historial de etapas del lead, ordenado por moved_at asc */
  async getLeadStageHistory(leadId: string): Promise<LeadStageHistoryRow[]> {
    const { data, error } = await supabase
      .from('lead_stage_history')
      .select('id, lead_id, from_stage_id, to_stage_id, moved_at, occurred_at, idempotency_key')
      .eq('lead_id', leadId)
      .order('moved_at', { ascending: true })

    if (error) throw error
    return (data || []) as LeadStageHistoryRow[]
  },

  async moveLeadStage(
    leadId: string,
    toStageId: string,
    idempotencyKey: string,
    occurredAt?: string | null
  ): Promise<void> {
    const payload: Record<string, unknown> = {
      p_lead_id: leadId,
      p_to_stage_id: toStageId,
      p_idempotency_key: idempotencyKey,
    }
    if (occurredAt != null) {
      payload.p_occurred_at = occurredAt
    }
    const { error } = await supabase.rpc('move_lead_stage', payload)

    if (error) throw error
  },

  async deleteLead(leadId: string): Promise<void> {
    const { error } = await supabase.from('leads').delete().eq('id', leadId)

    if (error) throw error
  },
}
