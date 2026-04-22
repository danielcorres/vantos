import { supabase } from '../../lib/supabaseClient'

/** Normaliza next_action_type a solo 'contact' | 'meeting' (compatibilidad con legacy). */
function normalizeNextActionType(t: string | null | undefined): string | null {
  const v = (t ?? '').trim().toLowerCase()
  if (!v) return null
  if (v === 'meeting' || v === 'contact') return v
  if (v === 'call' || v === 'follow_up') return 'contact'
  if (v === 'presentation') return 'meeting'
  return 'contact'
}

const LEAD_SELECT_COLUMNS =
  'id,owner_user_id,full_name,phone,email,source,notes,stage_id,stage_changed_at,created_at,updated_at,last_contact_at,next_follow_up_at,archived_at,archived_by,archive_reason,referral_name,cita_realizada_at,propuesta_presentada_at,cerrado_at,lead_condition,next_action_at,next_action_type,momento_override'

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
    next_action_at: (row.next_action_at as string | null) ?? null,
    next_action_type: (row.next_action_type as string | null) ?? null,
    momento_override: (row.momento_override as string | null) ?? null,
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
  lead_condition: string | null
  next_action_at: string | null
  next_action_type: string | null
  momento_override: string | null
}

export type CreateLeadInput = {
  full_name: string
  phone?: string
  email?: string
  source?: string
  notes?: string
  stage_id: string
  next_follow_up_at?: string
  next_action_at: string
  next_action_type?: string | null
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
        .select(LEAD_SELECT_COLUMNS)
        .order('created_at', { ascending: false })
        .is('archived_at', null)
      if (error) throw error
      return (data || []).map(normalizeLead)
    }

    const { data, error } = await supabase
      .from('leads')
      .select(LEAD_SELECT_COLUMNS)
      .order('created_at', { ascending: false })
      .not('archived_at', 'is', null)
    if (error) throw error
    return (data || []).map(normalizeLead)
  },

  async createLead(input: CreateLeadInput): Promise<Lead> {
    const normalizedType = normalizeNextActionType(input.next_action_type)

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
        next_action_at: input.next_action_at,
        next_action_type: normalizedType,
      })
      .select(LEAD_SELECT_COLUMNS)
      .single()

    if (error) {
      if (import.meta.env?.DEV) {
        console.error('[createLead] Supabase error:', error)
      }
      const code = (error as { code?: string })?.code
      const msg = (error as { message?: string })?.message ?? ''
      if (code === '23514') {
        throw new Error(
          'Lead activo debe tener Próxima Acción válida. Define fecha o deja el tipo vacío.'
        )
      }
      if (code === '22P02') {
        throw new Error('Etapa inválida (UUID). Recarga pipeline.')
      }
      if (code === '42501' || /policy|permission|row-level|rls/i.test(msg)) {
        throw new Error('No tienes permisos o tu sesión expiró. Recarga e inicia sesión.')
      }
      throw error
    }
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
    lead_condition?: string | null
    next_action_at?: string | null
    next_action_type?: string | null
    momento_override?: string | null
  }): Promise<Lead> {
    if (
      updates.next_action_at === null &&
      (updates.archived_at === undefined || updates.archived_at === null)
    ) {
      throw new Error(
        'Lead activo requiere Próxima Acción. Para quitarla debes archivar el lead.'
      )
    }

    const payload = { ...updates }
    if (payload.next_action_type !== undefined) {
      payload.next_action_type = normalizeNextActionType(payload.next_action_type)
    }

    const { data, error } = await supabase
      .from('leads')
      .update(payload)
      .eq('id', leadId)
      .select(LEAD_SELECT_COLUMNS)
      .single()

    if (error) {
      const msg =
        error.code === '23514'
          ? 'Lead activo debe tener Próxima Acción. Define una fecha o archiva el lead.'
          : error.message
      throw new Error(msg)
    }
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

  /** Registra completado de próximo paso (contact→calls, meeting→meetings_held vía RPC). */
  async logNextActionCompletion(leadId: string, actionType: 'contact' | 'meeting'): Promise<void> {
    const { error } = await supabase.rpc('log_next_action_completion', {
      p_lead_id: leadId,
      p_action_type: actionType,
    })
    if (error) throw new Error(error.message)
  },
}
