import { supabase } from '../../lib/supabase'
import type {
  CreatePolicyInput,
  Currency,
  PaymentFrequency,
  Policy,
  PolicyFilters,
  Ramo,
  ReceiptStatus,
  UpdatePolicyInput,
} from './policies.types'
import { CURRENCIES, PAYMENT_FREQUENCIES, RAMOS, RECEIPT_STATUSES } from './policies.types'

export const POLICY_COLUMNS =
  'id,owner_user_id,lead_id,contractor_name,insurer,policy_number,ramo,product_name,' +
  'start_date,end_date,issued_at,premium_amount,currency,payment_frequency,receipt_status,' +
  'campaign_source,is_countable,created_at,updated_at'

function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_')
}

function parseRamo(v: unknown): Ramo | null {
  return typeof v === 'string' && (RAMOS as readonly string[]).includes(v) ? (v as Ramo) : null
}

function parseCurrency(v: unknown): Currency | null {
  return typeof v === 'string' && (CURRENCIES as readonly string[]).includes(v) ? (v as Currency) : null
}

function parsePaymentFrequency(v: unknown): PaymentFrequency | null {
  return typeof v === 'string' && (PAYMENT_FREQUENCIES as readonly string[]).includes(v)
    ? (v as PaymentFrequency)
    : null
}

function parseReceiptStatus(v: unknown): ReceiptStatus | null {
  return typeof v === 'string' && (RECEIPT_STATUSES as readonly string[]).includes(v)
    ? (v as ReceiptStatus)
    : null
}

function normalizePolicy(row: Record<string, unknown>): Policy {
  const ramo = parseRamo(row.ramo)
  const currency = parseCurrency(row.currency)
  const payment_frequency = parsePaymentFrequency(row.payment_frequency)
  const receipt_status = parseReceiptStatus(row.receipt_status)
  if (!ramo || !currency || !payment_frequency || !receipt_status) {
    throw new Error('Fila de póliza con valores inválidos')
  }
  const premium = row.premium_amount
  const premium_amount =
    typeof premium === 'number' ? premium : typeof premium === 'string' ? Number(premium) : NaN
  if (!Number.isFinite(premium_amount)) {
    throw new Error('Prima inválida')
  }
  return {
    id: String(row.id),
    owner_user_id: String(row.owner_user_id),
    lead_id: row.lead_id == null ? null : String(row.lead_id),
    contractor_name: String(row.contractor_name ?? ''),
    insurer: String(row.insurer ?? ''),
    policy_number: String(row.policy_number ?? ''),
    ramo,
    product_name: String(row.product_name ?? ''),
    start_date: String(row.start_date ?? ''),
    end_date: String(row.end_date ?? ''),
    issued_at: row.issued_at == null ? null : String(row.issued_at),
    premium_amount,
    currency,
    payment_frequency,
    receipt_status,
    campaign_source: row.campaign_source == null ? null : String(row.campaign_source),
    is_countable: Boolean(row.is_countable),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

function mapSupabaseError(err: { message?: string; code?: string; details?: string }): Error {
  const code = err.code
  const msg = err.message ?? 'Error desconocido'
  if (code === '23505') {
    return new Error('Ya existe una póliza con ese número para tu cuenta.')
  }
  if (code === '23514') {
    return new Error('Los datos no cumplen las reglas de validación (fechas o montos).')
  }
  return new Error(msg)
}

export const policiesApi = {
  async list(filters?: PolicyFilters): Promise<Policy[]> {
    let q = supabase.from('policies').select(POLICY_COLUMNS).order('created_at', { ascending: false })

    if (filters?.ramo) {
      q = q.eq('ramo', filters.ramo)
    }
    if (filters?.insurer?.trim()) {
      const term = `%${escapeIlikePattern(filters.insurer.trim())}%`
      q = q.ilike('insurer', term)
    }
    if (filters?.receipt_status) {
      q = q.eq('receipt_status', filters.receipt_status)
    }
    if (filters?.start_date_from) {
      q = q.gte('start_date', filters.start_date_from)
    }
    if (filters?.start_date_to) {
      q = q.lte('start_date', filters.start_date_to)
    }

    const { data, error } = await q
    if (error) throw mapSupabaseError(error)
    return (data ?? []).map((row) => normalizePolicy(row as unknown as Record<string, unknown>))
  },

  async getById(id: string): Promise<Policy | null> {
    const { data, error } = await supabase
      .from('policies')
      .select(POLICY_COLUMNS)
      .eq('id', id)
      .maybeSingle()

    if (error) throw mapSupabaseError(error)
    if (!data) return null
    return normalizePolicy(data as unknown as Record<string, unknown>)
  },

  async create(input: CreatePolicyInput): Promise<Policy> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) throw new Error('Sesión requerida')

    const row = {
      ...input,
      owner_user_id: user.id,
    }

    const { data, error } = await supabase.from('policies').insert(row).select(POLICY_COLUMNS).single()

    if (error) throw mapSupabaseError(error)
    return normalizePolicy(data as unknown as Record<string, unknown>)
  },

  async update(id: string, input: UpdatePolicyInput): Promise<Policy> {
    const patch = Object.fromEntries(
      Object.entries(input).filter(([, v]) => v !== undefined)
    ) as UpdatePolicyInput

    const { data, error } = await supabase
      .from('policies')
      .update(patch)
      .eq('id', id)
      .select(POLICY_COLUMNS)
      .single()

    if (error) throw mapSupabaseError(error)
    return normalizePolicy(data as unknown as Record<string, unknown>)
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('policies').delete().eq('id', id)
    if (error) throw mapSupabaseError(error)
  },
}
