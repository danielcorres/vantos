import { supabase } from '../../../lib/supabaseClient'
import type { StageSlug } from '../types/productivity.types'
import { STAGE_SLUGS_ORDER } from '../types/productivity.types'

function rowToGoals(row: Record<string, unknown>): Record<StageSlug, number> {
  const goals = {} as Record<StageSlug, number>
  for (const slug of STAGE_SLUGS_ORDER) {
    const v = row[slug]
    const n = typeof v === 'number' ? v : Number(v)
    goals[slug] = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
  }
  return goals
}

/**
 * Obtiene las metas semanales del usuario actual.
 * Si no hay fila en DB, retorna null (el caller usará defaults).
 */
export async function getWeeklyGoals(): Promise<Record<StageSlug, number> | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user?.id) {
    return null
  }

  const { data, error } = await supabase
    .from('weekly_goals')
    .select('contactos_nuevos, citas_agendadas, casos_abiertos, citas_cierre, solicitudes_ingresadas, casos_ganados')
    .eq('owner_user_id', userData.user.id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return null

  return rowToGoals(data as Record<string, unknown>)
}

function validateGoals(goals: Record<StageSlug, number>): void {
  for (const slug of STAGE_SLUGS_ORDER) {
    const v = goals[slug]
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new Error(`Meta inválida para ${slug}: debe ser un número >= 0`)
    }
    if (v !== Math.floor(v)) {
      throw new Error(`Meta para ${slug} debe ser un número entero`)
    }
  }
}

/**
 * Crea o actualiza las metas semanales del usuario actual.
 * Valida que todos los valores sean >= 0 y enteros.
 */
export async function upsertWeeklyGoals(goals: Record<StageSlug, number>): Promise<void> {
  validateGoals(goals)

  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData?.user?.id) {
    throw new Error('No hay sesión activa')
  }

  const row = {
    owner_user_id: userData.user.id,
    contactos_nuevos: Math.floor(goals.contactos_nuevos),
    citas_agendadas: Math.floor(goals.citas_agendadas),
    casos_abiertos: Math.floor(goals.casos_abiertos),
    citas_cierre: Math.floor(goals.citas_cierre),
    solicitudes_ingresadas: Math.floor(goals.solicitudes_ingresadas),
    casos_ganados: Math.floor(goals.casos_ganados),
  }

  const { error } = await supabase.from('weekly_goals').upsert(row, {
    onConflict: 'owner_user_id',
  })

  if (error) throw new Error(error.message)
}
