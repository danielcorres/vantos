/**
 * Helpers para comparar semanas (vs semana anterior)
 * Timezone canónica: America/Monterrey
 */

import { addDaysYmd } from '../../../shared/utils/dates'

export type ActivityEventRow = {
  recorded_at: string
  metric_key: string
  value: number
  actor_user_id: string
}

/**
 * Obtener rango de semana anterior (lunes-domingo)
 * @param weekStartLocal Fecha de inicio de semana actual (lunes) en formato YYYY-MM-DD
 * @returns Rango de semana anterior: prevWeekStartLocal (lunes), prevWeekEndLocal (domingo), prevNextWeekStartLocal (lunes siguiente)
 */
export function getPrevWeekRangeLocal(weekStartLocal: string): {
  prevWeekStartLocal: string
  prevWeekEndLocal: string
  prevNextWeekStartLocal: string
} {
  // Restar 7 días al lunes actual para obtener el lunes anterior
  const prevWeekStartLocal = addDaysYmd(weekStartLocal, -7)
  const prevWeekEndLocal = addDaysYmd(prevWeekStartLocal, 6) // Domingo
  const prevNextWeekStartLocal = addDaysYmd(prevWeekStartLocal, 7) // Lunes siguiente (que es el lunes actual)

  return {
    prevWeekStartLocal,
    prevWeekEndLocal,
    prevNextWeekStartLocal,
  }
}

/**
 * Convertir fecha YYYY-MM-DD local a Date UTC 00:00:00
 * @param ymd Fecha en formato YYYY-MM-DD (timezone Monterrey)
 * @returns Date en UTC con hora 00:00:00
 */
export function localYmdToUTCStart(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0))
}

/**
 * Fetch eventos de activity_events para un rango de fechas
 * @param params Parámetros de la query
 * @returns Array de eventos del rango
 */
export async function fetchEventsForRange({
  supabase,
  advisorIds,
  fromYmdInclusive,
  toYmdExclusive,
}: {
  supabase: any
  advisorIds: string[]
  fromYmdInclusive: string
  toYmdExclusive: string
}): Promise<ActivityEventRow[]> {
  if (advisorIds.length === 0) {
    return []
  }

  const fromUTC = localYmdToUTCStart(fromYmdInclusive)
  const toUTC = localYmdToUTCStart(toYmdExclusive)

  const { data, error } = await supabase
    .from('activity_events')
    .select('recorded_at, metric_key, value, actor_user_id')
    .in('actor_user_id', advisorIds)
    .eq('is_void', false)
    .eq('source', 'manual')
    .gte('recorded_at', fromUTC.toISOString())
    .lt('recorded_at', toUTC.toISOString())
    .order('recorded_at', { ascending: true })

  if (error) {
    console.error('[fetchEventsForRange] Error:', error)
    return []
  }

  return (data || []).map((row: any) => ({
    recorded_at: row.recorded_at,
    metric_key: row.metric_key,
    value: row.value || 0,
    actor_user_id: row.actor_user_id,
  }))
}
