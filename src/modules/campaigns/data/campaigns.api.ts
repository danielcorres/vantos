import { supabase } from '../../../lib/supabase'
import type {
  Campaign,
  CampaignTrack,
  CampaignLevel,
  CampaignLevelReward,
  CampaignImport,
  CampaignImportUnmatchedRow,
  CampaignRewardAward,
  DashboardEntry,
  RankingEntry,
  SyncResult,
} from '../domain/types'

// ─── Campañas ────────────────────────────────────────────────────────────────

export async function fetchCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as Campaign[]
}

export async function createCampaign(
  payload: Omit<Campaign, 'id' | 'created_at' | 'updated_at'>
): Promise<Campaign> {
  const { data, error } = await supabase
    .from('campaigns')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw error
  return data as Campaign
}

export async function updateCampaign(
  id: string,
  payload: Partial<Omit<Campaign, 'id' | 'created_at' | 'updated_at'>>
): Promise<Campaign> {
  const { data, error } = await supabase
    .from('campaigns')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Campaign
}

// ─── Tracks ───────────────────────────────────────────────────────────────────

export async function fetchTracksByCampaign(campaignId: string): Promise<CampaignTrack[]> {
  const { data, error } = await supabase
    .from('campaign_tracks')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as CampaignTrack[]
}

export async function createTrack(
  payload: Omit<CampaignTrack, 'id' | 'created_at' | 'updated_at'>
): Promise<CampaignTrack> {
  const { data, error } = await supabase
    .from('campaign_tracks')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw error
  return data as CampaignTrack
}

export async function updateTrack(
  id: string,
  payload: Partial<Omit<CampaignTrack, 'id' | 'created_at' | 'updated_at'>>
): Promise<CampaignTrack> {
  const { data, error } = await supabase
    .from('campaign_tracks')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as CampaignTrack
}

// ─── Niveles ──────────────────────────────────────────────────────────────────

export async function fetchLevelsByCampaign(campaignId: string): Promise<CampaignLevel[]> {
  const { data, error } = await supabase
    .from('campaign_levels')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('level_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as CampaignLevel[]
}

export async function createLevel(
  payload: Omit<CampaignLevel, 'id' | 'created_at' | 'updated_at'>
): Promise<CampaignLevel> {
  const { data, error } = await supabase
    .from('campaign_levels')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw error
  return data as CampaignLevel
}

export async function updateLevel(
  id: string,
  payload: Partial<Omit<CampaignLevel, 'id' | 'created_at' | 'updated_at'>>
): Promise<CampaignLevel> {
  const { data, error } = await supabase
    .from('campaign_levels')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as CampaignLevel
}

// ─── Premios alternativos ─────────────────────────────────────────────────────

export async function fetchRewardsByLevel(levelId: string): Promise<CampaignLevelReward[]> {
  const { data, error } = await supabase
    .from('campaign_level_rewards')
    .select('*')
    .eq('level_id', levelId)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return (data ?? []) as CampaignLevelReward[]
}

export async function createLevelReward(
  payload: Omit<CampaignLevelReward, 'id' | 'created_at' | 'updated_at'>
): Promise<CampaignLevelReward> {
  const { data, error } = await supabase
    .from('campaign_level_rewards')
    .insert(payload)
    .select('*')
    .single()
  if (error) throw error
  return data as CampaignLevelReward
}

export async function updateLevelReward(
  id: string,
  payload: Partial<Omit<CampaignLevelReward, 'id' | 'created_at' | 'updated_at'>>
): Promise<CampaignLevelReward> {
  const { data, error } = await supabase
    .from('campaign_level_rewards')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as CampaignLevelReward
}

// ─── RPC: Dashboard ───────────────────────────────────────────────────────────

export async function fetchCampaignDashboard(periodo: string): Promise<DashboardEntry[]> {
  const { data, error } = await supabase.rpc('get_campaign_dashboard', {
    p_periodo: periodo,
  })
  if (error) throw error
  return (data ?? []) as DashboardEntry[]
}

// ─── RPC: Ranking ─────────────────────────────────────────────────────────────

export async function fetchCampaignRanking(
  periodo: string,
  campaignId: string,
  trackId?: string | null
): Promise<RankingEntry[]> {
  const { data, error } = await supabase.rpc('get_campaign_ranking', {
    p_periodo: periodo,
    p_campaign_id: campaignId,
    p_track_id: trackId ?? null,
  })
  if (error) throw error
  return (data ?? []) as RankingEntry[]
}

export async function fetchMyCampaignRank(
  periodo: string,
  campaignId: string,
  trackId?: string | null
): Promise<{ rank_pos: number; rank_total: number } | null> {
  const { data, error } = await supabase.rpc('get_my_campaign_rank', {
    p_periodo: periodo,
    p_campaign_id: campaignId,
    p_track_id: trackId ?? null,
  })
  if (error) throw error
  return data as { rank_pos: number; rank_total: number } | null
}

// ─── Imports ──────────────────────────────────────────────────────────────────

export async function fetchImports(limit = 20): Promise<CampaignImport[]> {
  const { data, error } = await supabase
    .from('campaign_imports')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as CampaignImport[]
}

export async function fetchUnmatchedRows(importId: string): Promise<CampaignImportUnmatchedRow[]> {
  const { data, error } = await supabase
    .from('campaign_import_unmatched_rows')
    .select('*')
    .eq('import_id', importId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as CampaignImportUnmatchedRow[]
}

// ─── Sync (Edge Function) ─────────────────────────────────────────────────────

export async function syncCampaignIndicators(periodo: string): Promise<SyncResult> {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token ?? ''

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-campaign-indicators`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
      },
      body: JSON.stringify({ periodo }),
    }
  )

  const json = await res.json() as SyncResult & { error?: string }
  if (!res.ok || !json.ok) {
    const msg = json.error ?? `HTTP ${res.status}`
    throw new Error(msg)
  }
  return json
}

// ─── RPC: Awards ──────────────────────────────────────────────────────────────

export async function fetchRewardAwards(filters?: {
  periodo?: string
  campaignId?: string
  status?: string
}): Promise<CampaignRewardAward[]> {
  let query = supabase
    .from('campaign_reward_awards')
    .select('*')
    .order('awarded_at', { ascending: false })

  if (filters?.periodo) query = query.eq('periodo', filters.periodo)
  if (filters?.campaignId) query = query.eq('campaign_id', filters.campaignId)
  if (filters?.status) query = query.eq('status', filters.status)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as CampaignRewardAward[]
}

export async function updateRewardAwardStatus(
  awardId: string,
  newStatus: string,
  notes?: string
): Promise<{ ok: boolean; new_status?: string; error?: string }> {
  const { data, error } = await supabase.rpc('update_reward_award_status', {
    p_award_id: awardId,
    p_new_status: newStatus,
    p_notes: notes ?? null,
  })
  if (error) throw error
  return data as { ok: boolean; new_status?: string; error?: string }
}

export async function selectReward(
  awardId: string,
  rewardId: string
): Promise<void> {
  const { error } = await supabase
    .from('campaign_reward_awards')
    .update({ selected_reward_id: rewardId })
    .eq('id', awardId)
  if (error) throw error
}
