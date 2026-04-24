import { useCallback, useEffect, useState } from 'react'
import { policyInsuredApi } from '../policyInsured.api'
import type { PolicyInsured } from '../policies.insured.types'

export interface UsePolicyInsuredResult {
  insured: PolicyInsured[]
  loading: boolean
  error: string | null
  reload: () => void
}

export function usePolicyInsured(policyId: string | null): UsePolicyInsuredResult {
  const [insured, setInsured] = useState<PolicyInsured[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState(0)

  const reload = useCallback(() => {
    setToken((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!policyId) {
      setInsured([])
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const rows = await policyInsuredApi.list(policyId)
        if (!cancelled) setInsured(rows)
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error al cargar asegurados')
          setInsured([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [policyId, token])

  return { insured, loading, error, reload }
}
