import { useState, useEffect, useCallback } from 'react'
import { fetchCampaignDashboard } from '../data/campaigns.api'
import type { DashboardEntry } from '../domain/types'

interface UseCampaignDashboardResult {
  entries: DashboardEntry[]
  loading: boolean
  error: string | null
  reload: () => void
}

export function useCampaignDashboard(periodo: string): UseCampaignDashboardResult {
  const [entries, setEntries] = useState<DashboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCampaignDashboard(periodo)
      setEntries(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar el dashboard')
    } finally {
      setLoading(false)
    }
  }, [periodo])

  useEffect(() => {
    void load()
  }, [load])

  return { entries, loading, error, reload: load }
}
