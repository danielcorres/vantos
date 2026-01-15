/**
 * Helpers para manejar perfiles de usuario
 */

import { supabase } from './supabaseClient'

export interface Profile {
  user_id: string
  role: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  full_name: string | null
  created_at: string
  updated_at: string
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
}: {
  first_name: string
  last_name: string
}): Promise<Profile> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('No hay usuario autenticado')
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        user_id: user.id,
        first_name: first_name.trim() || null,
        last_name: last_name.trim() || null,
      },
      {
        onConflict: 'user_id',
      }
    )
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
