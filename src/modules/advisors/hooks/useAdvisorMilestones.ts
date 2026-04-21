import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchAdvisorMilestoneProfiles,
  fetchMilestonePolicyCounts,
  type AdvisorMilestoneProfile,
} from '../data/advisorMilestones.api'
import {
  getAdvisorMilestoneStatus,
  type AdvisorMilestoneStatus,
} from '../domain/advisorMilestones'

export interface AdvisorMilestoneEntry {
  profile: AdvisorMilestoneProfile
  status: AdvisorMilestoneStatus
}

export interface UseAdvisorMilestonesResult {
  data: Map<string, AdvisorMilestoneEntry>
  loading: boolean
  error: string | null
  reload: () => void
}

/**
 * Hook para cargar perfiles de asesores + conteo de pólizas vida y
 * construir el estado de hitos por asesor.
 *
 * Sigue el patrón del resto del codebase (useState + useEffect + useCallback,
 * sin React Query).
 */
export function useAdvisorMilestones(advisorIds: string[]): UseAdvisorMilestonesResult {
  const [data, setData] = useState<Map<string, AdvisorMilestoneEntry>>(new Map())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Serializar advisorIds para poder usarlo como dependencia estable.
  const idsKey = advisorIds.slice().sort().join(',')

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',') : []

    if (ids.length === 0) {
      setData(new Map())
      setLoading(false)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    const run = async () => {
      try {
        const profiles = await fetchAdvisorMilestoneProfiles(ids)
        const counts = await fetchMilestonePolicyCounts(profiles)

        if (cancelled || !mountedRef.current) return

        const now = new Date()
        const next = new Map<string, AdvisorMilestoneEntry>()

        for (const profile of profiles) {
          const c = counts.get(profile.user_id) ?? { phase1: 0, phase2Cumulative: 0 }
          const status = getAdvisorMilestoneStatus(
            {
              advisor_status: profile.advisor_status,
              key_activation_date: profile.key_activation_date,
              connection_date: profile.connection_date,
              life_policies_paid_in_phase1: c.phase1,
              life_policies_cumulative_phase2: c.phase2Cumulative,
            },
            now
          )
          next.set(profile.user_id, { profile, status })
        }

        setData(next)
        setLoading(false)
      } catch (err) {
        if (cancelled || !mountedRef.current) return
        console.error('[useAdvisorMilestones] Error al cargar hitos:', err)
        setError(err instanceof Error ? err.message : 'Error al cargar hitos')
        setLoading(false)
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [idsKey, reloadKey])

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  return { data, loading, error, reload }
}
