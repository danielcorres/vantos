import { useState, useEffect, useCallback } from 'react'
import {
  fetchCampaigns,
  createCampaign,
  updateCampaign,
} from '../data/campaigns.api'
import type { Campaign } from '../domain/types'

interface UseCampaignsConfigResult {
  campaigns: Campaign[]
  loading: boolean
  error: string | null
  reload: () => void
  create: (payload: Omit<Campaign, 'id' | 'created_at' | 'updated_at'>) => Promise<Campaign>
  update: (id: string, payload: Partial<Omit<Campaign, 'id' | 'created_at' | 'updated_at'>>) => Promise<Campaign>
}

export function useCampaignsConfig(): UseCampaignsConfigResult {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCampaigns()
      setCampaigns(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar campañas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const create = async (
    payload: Omit<Campaign, 'id' | 'created_at' | 'updated_at'>
  ): Promise<Campaign> => {
    const newCampaign = await createCampaign(payload)
    setCampaigns(prev => [...prev, newCampaign].sort((a, b) => a.sort_order - b.sort_order))
    return newCampaign
  }

  const update = async (
    id: string,
    payload: Partial<Omit<Campaign, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<Campaign> => {
    const updated = await updateCampaign(id, payload)
    setCampaigns(prev => prev.map(c => (c.id === id ? updated : c)))
    return updated
  }

  return { campaigns, loading, error, reload: load, create, update }
}
