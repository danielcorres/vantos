import { useCallback, useEffect, useState } from 'react'
import { policiesApi } from '../policies.api'
import type { Policy, PolicyFilters } from '../policies.types'

export interface UsePoliciesResult {
  policies: Policy[]
  loading: boolean
  error: string | null
  filters: PolicyFilters
  setFilters: (f: PolicyFilters) => void
  reload: () => void
}

export function usePolicies(initialFilters: PolicyFilters = {}): UsePoliciesResult {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<PolicyFilters>(initialFilters)
  const [reloadToken, setReloadToken] = useState(0)

  const reload = useCallback(() => {
    setReloadToken((n) => n + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const rows = await policiesApi.list(filters)
        if (!cancelled) setPolicies(rows)
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error al cargar pólizas')
          setPolicies([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [filters, reloadToken])

  return { policies, loading, error, filters, setFilters, reload }
}
