import { supabase } from '../../../lib/supabaseClient'
import { getPhase2Window } from '../domain/advisorMilestones'

export interface AdvisorMilestoneProfile {
  user_id: string
  full_name: string | null
  display_name: string | null
  first_name: string | null
  last_name: string | null
  birth_date: string | null
  advisor_code: string | null
  connection_date: string | null
  advisor_status: string | null
  contract_signed_at: string | null
}

export interface AdvisorLifePolicy {
  id: string
  advisor_user_id: string
  paid_at: string
  policy_number: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

const PROFILE_COLUMNS =
  'user_id, full_name, display_name, first_name, last_name, birth_date, advisor_code, connection_date, advisor_status, contract_signed_at'

export async function fetchAdvisorMilestoneProfiles(
  advisorIds: string[]
): Promise<AdvisorMilestoneProfile[]> {
  if (advisorIds.length === 0) return []

  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .in('user_id', advisorIds)

  if (error) throw error
  return (data ?? []) as AdvisorMilestoneProfile[]
}

export async function fetchAdvisorMilestoneProfileById(
  advisorId: string
): Promise<AdvisorMilestoneProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', advisorId)
    .maybeSingle()

  if (error) throw error
  return (data as AdvisorMilestoneProfile | null) ?? null
}

/**
 * Conteo eficiente por asesor usando la RPC get_advisor_life_policy_count.
 * Devuelve 0 para asesores sin contract_signed_at (no aplica aún Fase 2).
 */
export async function fetchLifePolicyCountsForPhase2(
  profiles: AdvisorMilestoneProfile[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>()

  const targets = profiles.filter(
    (p) => p.advisor_status === 'asesor_12_meses' && p.contract_signed_at
  )

  if (targets.length === 0) return result

  const counts = await Promise.all(
    targets.map(async (p) => {
      const window = getPhase2Window(p.contract_signed_at)
      if (!window) return [p.user_id, 0] as const
      const { data, error } = await supabase.rpc('get_advisor_life_policy_count', {
        p_advisor: p.user_id,
        p_from: window.from_ymd,
        p_to: window.to_ymd,
      })
      if (error) throw error
      const n = typeof data === 'number' ? data : Number(data ?? 0)
      return [p.user_id, Number.isFinite(n) ? n : 0] as const
    })
  )

  for (const [id, n] of counts) {
    result.set(id, n)
  }

  return result
}

export async function fetchAdvisorLifePolicies(
  advisorId: string
): Promise<AdvisorLifePolicy[]> {
  const { data, error } = await supabase
    .from('advisor_life_policies')
    .select('id, advisor_user_id, paid_at, policy_number, notes, created_by, created_at, updated_at')
    .eq('advisor_user_id', advisorId)
    .order('paid_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as AdvisorLifePolicy[]
}

export async function insertAdvisorLifePolicy(payload: {
  advisor_user_id: string
  paid_at: string
  policy_number?: string | null
  notes?: string | null
  created_by?: string | null
}): Promise<AdvisorLifePolicy> {
  const { data, error } = await supabase
    .from('advisor_life_policies')
    .insert(payload)
    .select('id, advisor_user_id, paid_at, policy_number, notes, created_by, created_at, updated_at')
    .single()

  if (error) throw error
  return data as AdvisorLifePolicy
}

export async function deleteAdvisorLifePolicy(id: string): Promise<void> {
  const { error } = await supabase.from('advisor_life_policies').delete().eq('id', id)
  if (error) throw error
}

export async function updateAdvisorProfile(
  userId: string,
  payload: Partial<
    Pick<
      AdvisorMilestoneProfile,
      'birth_date' | 'advisor_code' | 'connection_date' | 'advisor_status' | 'contract_signed_at'
    >
  >
): Promise<AdvisorMilestoneProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('user_id', userId)
    .select(PROFILE_COLUMNS)
    .single()

  if (error) throw error
  if (!data) throw new Error('Update did not return a row (possible RLS block).')
  return data as AdvisorMilestoneProfile
}
