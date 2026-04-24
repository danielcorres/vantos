import { supabase } from '../../lib/supabase'
import type { CreateInsuredInput, PolicyInsured, Relationship, UpdateInsuredInput } from './policies.insured.types'
import { RELATIONSHIPS } from './policies.insured.types'

const INSURED_COLUMNS =
  'id,policy_id,owner_user_id,full_name,relationship,birth_date,phone,email,notes,client_number,created_at,updated_at'

function parseRelationship(v: unknown): Relationship | null {
  return typeof v === 'string' && (RELATIONSHIPS as readonly string[]).includes(v) ? (v as Relationship) : null
}

function normalizeInsured(row: Record<string, unknown>): PolicyInsured {
  const relationship = parseRelationship(row.relationship)
  if (!relationship) throw new Error('Parentesco inválido')
  return {
    id: String(row.id),
    policy_id: String(row.policy_id),
    owner_user_id: String(row.owner_user_id),
    full_name: String(row.full_name ?? ''),
    relationship,
    birth_date: row.birth_date == null ? null : String(row.birth_date),
    phone: row.phone == null ? null : String(row.phone),
    email: row.email == null ? null : String(row.email),
    notes: row.notes == null ? null : String(row.notes),
    client_number: row.client_number == null ? null : String(row.client_number),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  }
}

function mapErr(err: { message?: string; code?: string }): Error {
  return new Error(err.message ?? 'Error')
}

export const policyInsuredApi = {
  async list(policyId: string): Promise<PolicyInsured[]> {
    const { data, error } = await supabase
      .from('policy_insured')
      .select(INSURED_COLUMNS)
      .eq('policy_id', policyId)
      .order('created_at', { ascending: true })

    if (error) throw mapErr(error)
    return (data ?? []).map((r) => normalizeInsured(r as unknown as Record<string, unknown>))
  },

  async create(input: CreateInsuredInput): Promise<PolicyInsured> {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) throw new Error('Sesión requerida')

    const row = { ...input, owner_user_id: user.id }
    const { data, error } = await supabase.from('policy_insured').insert(row).select(INSURED_COLUMNS).single()

    if (error) throw mapErr(error)
    return normalizeInsured(data as unknown as Record<string, unknown>)
  },

  async update(id: string, input: UpdateInsuredInput): Promise<PolicyInsured> {
    const patch = Object.fromEntries(
      Object.entries(input).filter(([, v]) => v !== undefined)
    ) as UpdateInsuredInput

    const { data, error } = await supabase
      .from('policy_insured')
      .update(patch)
      .eq('id', id)
      .select(INSURED_COLUMNS)
      .single()

    if (error) throw mapErr(error)
    return normalizeInsured(data as unknown as Record<string, unknown>)
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('policy_insured').delete().eq('id', id)
    if (error) throw mapErr(error)
  },
}
