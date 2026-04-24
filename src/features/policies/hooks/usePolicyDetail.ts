import { useCallback, useEffect, useState } from 'react'
import { policiesApi } from '../policies.api'
import type { Policy } from '../policies.types'

export interface UsePolicyDetailResult {
  policy: Policy | null
  loading: boolean
  error: string | null
  reload: () => void
  remove: () => Promise<void>
}

export function usePolicyDetail(policyId: string | null): UsePolicyDetailResult {
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [loading, setLoading] = useState(Boolean(policyId))
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState(0)

  const reload = useCallback(() => {
    setToken((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!policyId) {
      setPolicy(null)
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const row = await policiesApi.getById(policyId)
        if (!cancelled) {
          setPolicy(row)
          if (!row) setError('Póliza no encontrada')
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error al cargar')
          setPolicy(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [policyId, token])

  const remove = useCallback(async () => {
    if (!policyId) return
    await policiesApi.remove(policyId)
    setPolicy(null)
  }, [policyId])

  return { policy, loading, error, reload, remove }
}
