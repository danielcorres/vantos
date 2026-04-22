import { supabase } from '../../../lib/supabase'
import { getPhase1PolicyWindow, getPhase2CumulativeWindow } from '../domain/advisorMilestones'

export interface AdvisorMilestoneProfile {
  user_id: string
  full_name: string | null
  display_name: string | null
  first_name: string | null
  last_name: string | null
  birth_date: string | null
  advisor_code: string | null
  key_activation_date: string | null
  connection_date: string | null
  advisor_status: string | null
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
  'user_id, full_name, display_name, first_name, last_name, birth_date, advisor_code, key_activation_date, connection_date, advisor_status'

export type MilestonePolicyCounts = {
  phase1: number
  phase2Cumulative: number
}

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
 * Conteos por asesor: ventana Fase 1 (6 pólizas) y acumulado Fase 2 (12), vía RPC.
 */
export async function fetchMilestonePolicyCounts(
  profiles: AdvisorMilestoneProfile[]
): Promise<Map<string, MilestonePolicyCounts>> {
  const result = new Map<string, MilestonePolicyCounts>()

  const targets = profiles.filter((p) => p.advisor_status === 'asesor_12_meses' && p.key_activation_date)

  if (targets.length === 0) return result

  const rows = await Promise.all(
    targets.map(async (p) => {
      const w1 = getPhase1PolicyWindow(p.key_activation_date)
      let phase1 = 0
      if (w1) {
        const { data, error } = await supabase.rpc('get_advisor_life_policy_count', {
          p_advisor: p.user_id,
          p_from: w1.from_ymd,
          p_to: w1.to_ymd,
        })
        if (error) throw error
        const n = typeof data === 'number' ? data : Number(data ?? 0)
        phase1 = Number.isFinite(n) ? n : 0
      }

      const w2 = getPhase2CumulativeWindow(p.key_activation_date, p.connection_date)
      let phase2Cumulative = 0
      if (w2) {
        const { data, error } = await supabase.rpc('get_advisor_life_policy_count', {
          p_advisor: p.user_id,
          p_from: w2.from_ymd,
          p_to: w2.to_ymd,
        })
        if (error) throw error
        const n = typeof data === 'number' ? data : Number(data ?? 0)
        phase2Cumulative = Number.isFinite(n) ? n : 0
      }

      return [p.user_id, { phase1, phase2Cumulative }] as const
    })
  )

  for (const [id, counts] of rows) {
    result.set(id, counts)
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
      | 'birth_date'
      | 'advisor_code'
      | 'key_activation_date'
      | 'connection_date'
      | 'advisor_status'
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
