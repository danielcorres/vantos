import { supabase } from '../../../lib/supabase'

const TTL_MS = 90_000

export type CachedMetricDefinitionRow = {
  key: string
  label: string
  sort_order: number
}

type MetricScoresCache = {
  expires: number
  rows: { metric_key: string; points_per_unit: number }[]
}

let metricDefinitionsCache: { expires: number; rows: CachedMetricDefinitionRow[] } | null = null
let metricScoresCache: MetricScoresCache | null = null

export function invalidateOkrDailyLogStaticCache(): void {
  metricDefinitionsCache = null
  metricScoresCache = null
}

/**
 * Definiciones activas de métricas (TTL corto) para reducir round-trips al volver a OKR Diario.
 */
export async function fetchActiveMetricDefinitionsCached(): Promise<CachedMetricDefinitionRow[]> {
  const now = Date.now()
  if (metricDefinitionsCache && metricDefinitionsCache.expires > now) {
    return metricDefinitionsCache.rows
  }

  const { data, error } = await supabase
    .from('metric_definitions')
    .select('key, label, sort_order')
    .eq('is_active', true)
    .order('sort_order')

  if (error) throw error

  const rows = (data || []) as CachedMetricDefinitionRow[]
  metricDefinitionsCache = { rows, expires: now + TTL_MS }
  return rows
}

/**
 * Puntajes globales por métrica (TTL corto).
 */
export async function fetchMetricScoresCached(): Promise<{ metric_key: string; points_per_unit: number }[]> {
  const now = Date.now()
  if (metricScoresCache && metricScoresCache.expires > now) {
    return metricScoresCache.rows
  }

  const { data, error } = await supabase
    .from('okr_metric_scores_global')
    .select('metric_key, points_per_unit')
    .order('metric_key')

  if (error) throw error

  const rows = data || []
  metricScoresCache = { rows, expires: now + TTL_MS }
  return rows
}
