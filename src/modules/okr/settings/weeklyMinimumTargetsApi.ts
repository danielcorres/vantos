/**
 * API helper para cargar y guardar mínimos semanales por asesor
 */

import { supabase } from '../../../lib/supabaseClient'
import { todayLocalYmd } from '../../../shared/utils/dates'
import { DEFAULT_WEEKLY_MINIMUMS, type WeeklyMinimumTargetsMap } from '../dashboard/weeklyMinimumTargets'

export type WeeklyMinimumRow = {
  metric_key: string
  target_units: number
}

/**
 * Cargar mínimos semanales desde DB
 * Retorna map y source ('db' o 'default')
 */
export async function loadWeeklyMinimumTargets(
  supabaseClient: typeof supabase,
  ownerUserId: string | null
): Promise<{ map: WeeklyMinimumTargetsMap; source: 'db' | 'default' }> {
  if (!ownerUserId) {
    return { map: DEFAULT_WEEKLY_MINIMUMS, source: 'default' }
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
      console.error('[loadWeeklyMinimumTargets] Error:', error)
      return { map: DEFAULT_WEEKLY_MINIMUMS, source: 'default' }
    }

    if (!data || data.length === 0) {
      return { map: DEFAULT_WEEKLY_MINIMUMS, source: 'default' }
    }

    // Construir map desde DB
    const dbMap: WeeklyMinimumTargetsMap = {}
    data.forEach((row) => {
      dbMap[row.metric_key] = row.target_units
    })

    // Merge con defaults para métricas faltantes (forward-compat)
    const mergedMap: WeeklyMinimumTargetsMap = { ...DEFAULT_WEEKLY_MINIMUMS }
    Object.keys(dbMap).forEach((key) => {
      mergedMap[key] = dbMap[key]
    })

    return { map: mergedMap, source: 'db' }
  } catch (err) {
    console.error('[loadWeeklyMinimumTargets] Exception:', err)
    return { map: DEFAULT_WEEKLY_MINIMUMS, source: 'default' }
  }
}

/**
 * Guardar mínimos semanales en DB
 * Usa UPSERT con onConflict en (owner_user_id, role, metric_key)
 */
export async function saveWeeklyMinimumTargets(
  supabaseClient: typeof supabase,
  ownerUserId: string,
  map: WeeklyMinimumTargetsMap
): Promise<void> {
  if (!ownerUserId) {
    throw new Error('ownerUserId es requerido')
  }

  const todayLocal = todayLocalYmd()

  // Construir array de rows para upsert
  const rows = Object.entries(map).map(([metric_key, target_units]) => ({
    owner_user_id: ownerUserId,
    role: 'advisor' as const,
    metric_key,
    target_units: Math.max(0, Math.floor(target_units)), // Asegurar entero >= 0
    effective_from: todayLocal,
    effective_to: null,
  }))

  try {
    const { error: upsertError } = await supabaseClient
      .from('okr_weekly_minimum_targets')
      .upsert(rows, {
        onConflict: 'owner_user_id,role,metric_key',
      })

    if (upsertError) {
      console.warn('[saveWeeklyMinimumTargets] Upsert falló, intentando update+insert:', upsertError)

      for (const row of rows) {
        const { data: existing } = await supabaseClient
          .from('okr_weekly_minimum_targets')
          .select('id')
          .eq('owner_user_id', row.owner_user_id)
          .eq('role', row.role)
          .eq('metric_key', row.metric_key)
          .maybeSingle()

        if (existing) {
          const { error: updateError } = await supabaseClient
            .from('okr_weekly_minimum_targets')
            .update({ target_units: row.target_units })
            .eq('id', existing.id)

          if (updateError) {
            throw updateError
          }
        } else {
          const { error: insertError } = await supabaseClient
            .from('okr_weekly_minimum_targets')
            .insert(row)

          if (insertError) {
            throw insertError
          }
        }
      }
    }
  } catch (err: unknown) {
    const error = err as { status?: number; code?: string; message?: string }
    
    // Manejar errores de permisos
    if (
      error.status === 401 ||
      error.status === 403 ||
      error.code === '42501' ||
      error.message?.includes('policy') ||
      error.message?.includes('permission') ||
      error.message?.includes('Not authorized')
    ) {
      throw new Error('No tienes permisos para editar esta configuración')
    }

    throw new Error(
      error.message || 'Error al guardar mínimos semanales'
    )
  }
}
