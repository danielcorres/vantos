import { supabase } from '../../lib/supabase'

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
  'id,owner_user_id,full_name,phone,email,source,notes,stage_id,stage_changed_at,created_at,updated_at,last_contact_at,next_follow_up_at,archived_at,archived_by,archive_reason,referral_name,cita_realizada_at,propuesta_presentada_at,cerrado_at,lead_condition,next_action_at,next_action_type,estimated_value,expected_close_at,temperature'

/** Tamaño de página por etapa en Kanban y página por defecto en listas. */
export const PIPELINE_STAGE_PAGE_SIZE = 50

export type ActivosQueryParams = {
  offset: number
  limit: number
  /** Búsqueda en nombre, teléfono o email (ilike) */
  search?: string
  source?: string
  /** '' | '__null__' | frio | tibio | caliente */
  temperature?: string
  /** Si viene, limita a estos ids (p. ej. filtro semanal) */
  idsIn?: string[] | null
}

function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

export type LeadTemperature = 'frio' | 'tibio' | 'caliente'

function parseLeadTemperature(v: unknown): LeadTemperature | null {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : ''
  if (s === 'frio' || s === 'tibio' || s === 'caliente') return s
  return null
}

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
    estimated_value: (row.estimated_value as number | null) ?? null,
    expected_close_at: (row.expected_close_at as string | null) ?? null,
    temperature: parseLeadTemperature(row.temperature),
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
  estimated_value: number | null
  expected_close_at: string | null
  temperature: LeadTemperature | null
}

export type CreateLeadInput = {
  full_name: string
  phone?: string
  email?: string
  source?: string
  notes?: string
  stage_id: string
  next_follow_up_at?: string
  /** Opcional: si no se envía, el lead queda sin próxima acción. */
  next_action_at?: string | null
  next_action_type?: string | null
  /** Temperatura de interés; omitir o null = sin clasificar. */
  temperature?: LeadTemperature | null
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

  /** Total de leads activos (sin archivar). */
  async getActiveLeadsTotalCount(): Promise<number> {
    const { count, error } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .is('archived_at', null)
    if (error) throw error
    return count ?? 0
  },

  /** Total archivados. */
  async getArchivedLeadsTotalCount(): Promise<number> {
    const { count, error } = await supabase
      .from('leads')
      .select('id', { count: 'exact', head: true })
      .not('archived_at', 'is', null)
    if (error) throw error
    return count ?? 0
  },

  /** Conteo de activos por etapa (en paralelo). */
  async getActiveLeadCountsByStages(stageIds: string[]): Promise<Record<string, number>> {
    const results = await Promise.all(
      stageIds.map(async (stageId) => {
        const { count, error } = await supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('stage_id', stageId)
          .is('archived_at', null)
        if (error) throw error
        return [stageId, count ?? 0] as const
      })
    )
    return Object.fromEntries(results)
  },

  /**
   * Activos en una etapa, orden alineado con Kanban (next_action_at asc, nulls last, id).
   */
  async getLeadsForStage(
    stageId: string,
    opts: { offset: number; limit?: number }
  ): Promise<Lead[]> {
    const limit = opts.limit ?? PIPELINE_STAGE_PAGE_SIZE
    const end = opts.offset + limit - 1
    const { data, error } = await supabase
      .from('leads')
      .select(LEAD_SELECT_COLUMNS)
      .eq('stage_id', stageId)
      .is('archived_at', null)
      .order('next_action_at', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })
      .range(opts.offset, end)
    if (error) throw error
    return (data || []).map(normalizeLead)
  },

  /** Carga activos por ids (p. ej. filtro semanal sin traer todo el pipeline). */
  async getLeadsByIds(ids: string[]): Promise<Lead[]> {
    if (ids.length === 0) return []
    const { data, error } = await supabase
      .from('leads')
      .select(LEAD_SELECT_COLUMNS)
      .in('id', ids)
      .is('archived_at', null)
    if (error) throw error
    return (data || []).map(normalizeLead)
  },

  /**
   * Lista activos con filtros y total (misma consulta con count).
   * Orden: next_action_at asc nulls last, id (coherente con Kanban por prioridad de fecha).
   */
  async queryActivosLeads(params: ActivosQueryParams): Promise<{ leads: Lead[]; total: number }> {
    if (params.idsIn !== undefined && params.idsIn !== null && params.idsIn.length === 0) {
      return { leads: [], total: 0 }
    }
    const limit = params.limit
    const end = params.offset + limit - 1
    let q = supabase
      .from('leads')
      .select(LEAD_SELECT_COLUMNS, { count: 'exact' })
      .is('archived_at', null)

    if (params.idsIn && params.idsIn.length > 0) {
      q = q.in('id', params.idsIn)
    }

    const qTrim = params.search?.trim()
    if (qTrim) {
      const safe = escapeIlikePattern(qTrim.replace(/,/g, ' '))
      const pattern = `%${safe}%`
      q = q.or(`full_name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`)
    }

    const src = params.source?.trim()
    if (src) {
      q = q.eq('source', src)
    }

    const temp = params.temperature?.trim() ?? ''
    if (temp === '__null__') {
      q = q.is('temperature', null)
    } else if (temp === 'frio' || temp === 'tibio' || temp === 'caliente') {
      q = q.eq('temperature', temp)
    }

    const { data, error, count } = await q
      .order('next_action_at', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true })
      .range(params.offset, end)

    if (error) throw error
    return { leads: (data || []).map(normalizeLead), total: count ?? 0 }
  },

  /** Archivados paginados (más recientes primero). */
  async queryArchivedLeadsPage(opts: { offset: number; limit?: number }): Promise<{ leads: Lead[]; total: number }> {
    const limit = opts.limit ?? PIPELINE_STAGE_PAGE_SIZE
    const end = opts.offset + limit - 1
    const { data, error, count } = await supabase
      .from('leads')
      .select(LEAD_SELECT_COLUMNS, { count: 'exact' })
      .not('archived_at', 'is', null)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(opts.offset, end)
    if (error) throw error
    return { leads: (data || []).map(normalizeLead), total: count ?? 0 }
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
        next_action_at: input.next_action_at ?? null,
        next_action_type: normalizedType,
        temperature: input.temperature ?? null,
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
    estimated_value?: number | null
    expected_close_at?: string | null
    temperature?: LeadTemperature | null
  }): Promise<Lead> {
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

  /** Registra completado de próximo paso (contact→contacts_made, meeting→meetings_done). */
  async logNextActionCompletion(leadId: string, actionType: 'contact' | 'meeting'): Promise<void> {
    const { error } = await supabase.rpc('log_next_action_completion', {
      p_lead_id: leadId,
      p_action_type: actionType,
    })
    if (error) throw new Error(error.message)
  },
}
