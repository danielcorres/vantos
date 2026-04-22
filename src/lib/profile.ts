/**
 * Helpers para manejar perfiles de usuario
 */

import { supabase } from './supabase'

export interface Profile {
  user_id: string
  role: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  full_name: string | null
  /** YYYY-MM-DD desde Postgres; puede faltar si la migración aún no está aplicada */
  birth_date?: string | null
  advisor_code?: string | null
  key_activation_date?: string | null
  connection_date?: string | null
  advisor_status?: string | null
  /** Conservado en BD; no se edita desde Mi perfil (hitos usan alta de clave + conexión). */
  contract_signed_at?: string | null
  created_at: string
  updated_at: string
}

/** Campos de hitos en profiles; si se pasa a upsertMyProfile, se persisten juntos. */
export type MilestoneProfilePayload = {
  advisor_code: string | null
  key_activation_date: string | null
  connection_date: string | null
  advisor_status: string | null
}

/**
 * Obtener el perfil del usuario actual
 */
export async function getMyProfile(): Promise<Profile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  
  if (!user) {
    return null
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) {
    // Si no existe el perfil, retornar null (se creará automáticamente o en la pantalla de perfil)
    if (error.code === 'PGRST116') {
      return null
    }
    throw error
  }

  return data
}

/**
 * Crear o actualizar el perfil del usuario actual
 */
export async function upsertMyProfile({
  first_name,
  last_name,
  birth_date,
  milestone,
}: {
  first_name: string
  last_name: string
  /** Si se omite, no se envía y Postgres conserva el valor actual de birth_date */
  birth_date?: string | null
  /** Si se omite, no se tocan columnas de hitos de asesor */
  milestone?: MilestoneProfilePayload
}): Promise<Profile> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('No hay usuario autenticado')
  }

  const row: Record<string, unknown> = {
    user_id: user.id,
    first_name: first_name.trim() || null,
    last_name: last_name.trim() || null,
  }
  if (birth_date !== undefined) {
    const t = birth_date === null ? '' : String(birth_date).trim()
    row.birth_date = t === '' ? null : t
  }
  if (milestone !== undefined) {
    row.advisor_code = milestone.advisor_code?.trim() ? milestone.advisor_code.trim() : null
    row.key_activation_date = milestone.key_activation_date?.trim()
      ? milestone.key_activation_date.trim()
      : null
    row.connection_date = milestone.connection_date?.trim() ? milestone.connection_date.trim() : null
    const st = milestone.advisor_status?.trim() ? milestone.advisor_status.trim() : null
    row.advisor_status = st
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert(row, {
      onConflict: 'user_id',
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  return data
}

/**
 * Obtener el nombre completo del usuario (full_name o email como fallback)
 */
export async function getUserDisplayName(): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const profile = await getMyProfile()
  
  if (profile?.full_name && profile.full_name.trim()) {
    return profile.full_name.trim()
  }

  // Fallback a email
  return user.email || null
}
