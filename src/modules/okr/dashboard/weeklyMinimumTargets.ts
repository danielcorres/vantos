/**
 * Helper para obtener mínimos semanales por asesor
 * Incluye fallback a valores por defecto si no hay configuración en DB
 */

import { supabase } from '../../../lib/supabaseClient'
import { todayLocalYmd } from '../../../shared/utils/dates'

export type WeeklyMinimumTargetsMap = Record<string, number>

/**
 * Mínimos por defecto (hardcode) si no hay configuración en DB
 */
export const DEFAULT_WEEKLY_MINIMUMS: WeeklyMinimumTargetsMap = {
  calls: 30,
  meetings_set: 10,
  meetings_held: 8,
  proposals_presented: 5,
  applications_submitted: 1,
  referrals: 30,
  policies_paid: 1,
}

/**
 * Obtener mínimos semanales desde DB para un owner
 * Si no hay datos, retorna DEFAULT_WEEKLY_MINIMUMS
 * Si hay datos parciales, completa con defaults para forward-compat
 */
export async function fetchWeeklyMinimumTargetsForOwner(
  supabaseClient: typeof supabase,
  ownerUserId: string | null
): Promise<{ targets: WeeklyMinimumTargetsMap; source: 'db' | 'default' }> {
  if (!ownerUserId) {
    return { targets: DEFAULT_WEEKLY_MINIMUMS, source: 'default' }
  }

  const todayLocal = todayLocalYmd()

  try {
    const { data, error } = await supabaseClient
      .from('okr_weekly_minimum_targets')
      .select('metric_key, target_units')
      .eq('owner_user_id', ownerUserId)
      .eq('role', 'advisor')
      .lte('effective_from', todayLocal)
      .or(`effective_to.is.null,effective_to.gte.${todayLocal}`)
      .order('metric_key')

    if (error) {
      console.error('[fetchWeeklyMinimumTargetsForOwner] Error:', error)
      return { targets: DEFAULT_WEEKLY_MINIMUMS, source: 'default' }
    }

    if (!data || data.length === 0) {
      return { targets: DEFAULT_WEEKLY_MINIMUMS, source: 'default' }
    }

    // Construir map desde DB
    const dbTargets: WeeklyMinimumTargetsMap = {}
    data.forEach((row) => {
      dbTargets[row.metric_key] = row.target_units
    })

    // Completar con defaults para métricas faltantes (forward-compat)
    const mergedTargets: WeeklyMinimumTargetsMap = { ...DEFAULT_WEEKLY_MINIMUMS }
    Object.keys(dbTargets).forEach((key) => {
      mergedTargets[key] = dbTargets[key]
    })

    return { targets: mergedTargets, source: 'db' }
  } catch (err) {
    console.error('[fetchWeeklyMinimumTargetsForOwner] Exception:', err)
    return { targets: DEFAULT_WEEKLY_MINIMUMS, source: 'default' }
  }
}
