import { useState, useEffect, useCallback } from 'react'
import {
  fetchLevelsByCampaign,
  fetchTracksByCampaign,
  createLevel,
  updateLevel,
  createTrack,
  updateTrack,
  fetchRewardsByLevel,
  createLevelReward,
  updateLevelReward,
} from '../data/campaigns.api'
import type { CampaignLevel, CampaignTrack, CampaignLevelReward } from '../domain/types'

interface UseCampaignLevelsResult {
  levels: CampaignLevel[]
  tracks: CampaignTrack[]
  loading: boolean
  error: string | null
  reload: () => void
  createLvl: (payload: Omit<CampaignLevel, 'id' | 'created_at' | 'updated_at'>) => Promise<CampaignLevel>
  updateLvl: (id: string, payload: Partial<Omit<CampaignLevel, 'id' | 'created_at' | 'updated_at'>>) => Promise<CampaignLevel>
  createTrk: (payload: Omit<CampaignTrack, 'id' | 'created_at' | 'updated_at'>) => Promise<CampaignTrack>
  updateTrk: (id: string, payload: Partial<Omit<CampaignTrack, 'id' | 'created_at' | 'updated_at'>>) => Promise<CampaignTrack>
  fetchRewards: (levelId: string) => Promise<CampaignLevelReward[]>
  addReward: (payload: Omit<CampaignLevelReward, 'id' | 'created_at' | 'updated_at'>) => Promise<CampaignLevelReward>
  editReward: (id: string, payload: Partial<Omit<CampaignLevelReward, 'id' | 'created_at' | 'updated_at'>>) => Promise<CampaignLevelReward>
}

export function useCampaignLevels(campaignId: string): UseCampaignLevelsResult {
  const [levels, setLevels] = useState<CampaignLevel[]>([])
  const [tracks, setTracks] = useState<CampaignTrack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [lvls, trks] = await Promise.all([
        fetchLevelsByCampaign(campaignId),
        fetchTracksByCampaign(campaignId),
      ])
      setLevels(lvls)
      setTracks(trks)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar niveles')
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => {
    void load()
  }, [load])

  const createLvl = async (
    payload: Omit<CampaignLevel, 'id' | 'created_at' | 'updated_at'>
  ): Promise<CampaignLevel> => {
    const lvl = await createLevel(payload)
    setLevels(prev => [...prev, lvl].sort((a, b) => a.level_order - b.level_order))
    return lvl
  }

  const updateLvl = async (
    id: string,
    payload: Partial<Omit<CampaignLevel, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<CampaignLevel> => {
    const lvl = await updateLevel(id, payload)
    setLevels(prev => prev.map(l => (l.id === id ? lvl : l)))
    return lvl
  }

  const createTrk = async (
    payload: Omit<CampaignTrack, 'id' | 'created_at' | 'updated_at'>
  ): Promise<CampaignTrack> => {
    const trk = await createTrack(payload)
    setTracks(prev => [...prev, trk].sort((a, b) => a.sort_order - b.sort_order))
    return trk
  }

  const updateTrk = async (
    id: string,
    payload: Partial<Omit<CampaignTrack, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<CampaignTrack> => {
    const trk = await updateTrack(id, payload)
    setTracks(prev => prev.map(t => (t.id === id ? trk : t)))
    return trk
  }

  const fetchRewards = (levelId: string) => fetchRewardsByLevel(levelId)
  const addReward = (payload: Omit<CampaignLevelReward, 'id' | 'created_at' | 'updated_at'>) =>
    createLevelReward(payload)
  const editReward = (
    id: string,
    payload: Partial<Omit<CampaignLevelReward, 'id' | 'created_at' | 'updated_at'>>
  ) => updateLevelReward(id, payload)

  return {
    levels,
    tracks,
    loading,
    error,
    reload: load,
    createLvl,
    updateLvl,
    createTrk,
    updateTrk,
    fetchRewards,
    addReward,
    editReward,
  }
}
