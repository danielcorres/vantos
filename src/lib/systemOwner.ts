/**
 * Helper centralizado para obtener el System Owner ID
 * Fuente única de verdad: public.okr_settings_global.owner_user_id
 */

import { supabase } from './supabaseClient'

let systemOwnerIdCache: string | null | undefined = undefined
let systemOwnerIdPromise: Promise<string | null> | null = null

/**
 * Obtener el System Owner ID con cache en memoria
 * @returns owner_user_id o null si no existe
 */
export async function getSystemOwnerId(): Promise<string | null> {
  // Si hay una promesa en curso, reutilizarla
  if (systemOwnerIdPromise) {
    return systemOwnerIdPromise
  }

  // Si hay cache válido, retornarlo
  if (systemOwnerIdCache !== undefined) {
    return systemOwnerIdCache
  }

  // Crear nueva promesa para cargar
  systemOwnerIdPromise = (async () => {
    try {
      const { data, error } = await supabase
        .from('okr_settings_global')
        .select('owner_user_id')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('[getSystemOwnerId] Error al consultar okr_settings_global:', error)
        systemOwnerIdCache = null
        systemOwnerIdPromise = null
        return null
      }

      const ownerId = data?.owner_user_id ?? null
      systemOwnerIdCache = ownerId
      systemOwnerIdPromise = null
      return ownerId
    } catch (err) {
      console.error('[getSystemOwnerId] Excepción inesperada:', err)
      systemOwnerIdCache = null
      systemOwnerIdPromise = null
      return null
    }
  })()

  return systemOwnerIdPromise
}

/**
 * Limpiar el cache del System Owner ID
 * Útil cuando cambia la sesión o se actualiza la configuración
 */
export function clearSystemOwnerCache(): void {
  systemOwnerIdCache = undefined
  systemOwnerIdPromise = null
}
