import { useState } from 'react'
import { syncCampaignIndicators } from '../data/campaigns.api'
import type { SyncResult } from '../domain/types'

interface UseCampaignSyncResult {
  syncing: boolean
  lastResult: SyncResult | null
  error: string | null
  sync: (periodo: string) => Promise<SyncResult | null>
}

export function useCampaignSync(): UseCampaignSyncResult {
  const [syncing, setSyncing] = useState(false)
  const [lastResult, setLastResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sync = async (periodo: string): Promise<SyncResult | null> => {
    setSyncing(true)
    setError(null)
    try {
      const result = await syncCampaignIndicators(periodo)
      setLastResult(result)
      return result
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al sincronizar'
      setError(msg)
      return null
    } finally {
      setSyncing(false)
    }
  }

  return { syncing, lastResult, error, sync }
}
