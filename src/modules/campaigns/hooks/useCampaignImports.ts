import { useState, useEffect, useCallback } from 'react'
import { fetchImports, fetchUnmatchedRows } from '../data/campaigns.api'
import type { CampaignImport, CampaignImportUnmatchedRow } from '../domain/types'

interface UseCampaignImportsResult {
  imports: CampaignImport[]
  loading: boolean
  error: string | null
  reload: () => void
  loadUnmatched: (importId: string) => Promise<CampaignImportUnmatchedRow[]>
}

export function useCampaignImports(limit = 20): UseCampaignImportsResult {
  const [imports, setImports] = useState<CampaignImport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchImports(limit)
      setImports(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar importaciones')
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    void load()
  }, [load])

  const loadUnmatched = (importId: string) => fetchUnmatchedRows(importId)

  return { imports, loading, error, reload: load, loadUnmatched }
}
