import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../../lib/supabase'
import type { AdvisorPipelineRow, AdvisorPipelineSummaryData } from '../types/advisorPipeline.types'

type RpcRow = {
  slug: string
  stage_name: string
  stage_position: number
  current_count: number | string
  week_entries: number | string
}

function toNum(v: number | string | null | undefined): number {
  if (v == null) return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function buildSummaryData(rows: AdvisorPipelineRow[]): AdvisorPipelineSummaryData {
  const totalActive = rows.reduce((s, r) => s + r.current_count, 0)
  const weekEntriesTotal = rows.reduce((s, r) => s + r.week_entries, 0)
  const wonRow = rows.find((r) => r.slug === 'casos_ganados')
  const newRow = rows.find((r) => r.slug === 'contactos_nuevos')
  const wonThisWeek = wonRow?.week_entries ?? 0
  const newThisWeek = newRow?.week_entries ?? 0
  const wonSnapshot = wonRow?.current_count ?? 0
  const conversionPct =
    totalActive > 0 ? Math.round((wonSnapshot / totalActive) * 1000) / 10 : null

  return {
    rows,
    totalActive,
    weekEntriesTotal,
    wonThisWeek,
    newThisWeek,
    conversionPct,
  }
}

export function useAdvisorPipeline(
  advisorId: string | undefined,
  weekStart: string,
  canLoad: boolean
): {
  data: AdvisorPipelineSummaryData | null
  loading: boolean
  error: string | null
  refetch: () => void
} {
  const [data, setData] = useState<AdvisorPipelineSummaryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const refetch = useCallback(() => {
    setTick((t) => t + 1)
  }, [])

  useEffect(() => {
    if (!canLoad || !advisorId || !weekStart) {
      setLoading(false)
      setData(null)
      setError(null)
      return
    }

    let cancelled = false

    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: raw, error: rpcError } = await supabase.rpc('get_advisor_pipeline_summary', {
          p_user_id: advisorId,
          p_week_start: weekStart,
        })

        if (cancelled || !mountedRef.current) return
        if (rpcError) throw rpcError

        const rows: AdvisorPipelineRow[] = ((raw || []) as RpcRow[]).map((r) => ({
          slug: r.slug ?? '',
          stage_name: r.stage_name ?? '—',
          position: toNum(r.stage_position),
          current_count: toNum(r.current_count),
          week_entries: toNum(r.week_entries),
        }))

        rows.sort((a, b) => a.position - b.position)

        if (mountedRef.current) {
          setData(buildSummaryData(rows))
        }
      } catch (e) {
        if (!mountedRef.current || cancelled) return
        const msg = e instanceof Error ? e.message : 'Error al cargar pipeline'
        setError(msg)
        setData(null)
      } finally {
        if (mountedRef.current && !cancelled) {
          setLoading(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [advisorId, weekStart, canLoad, tick])

  return { data, loading, error, refetch }
}
