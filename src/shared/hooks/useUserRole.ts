import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../auth/AuthProvider'

type UserRole = 'advisor' | 'manager' | 'recruiter' | 'owner' | 'director' | 'seguimiento'

export type UseUserRoleResult = {
  role: UserRole
  isOwner: boolean
  canSeeConfig: boolean
  loading: boolean
  error: string | null
  retry: () => void
}

const ROLE_TIMEOUT_MS = 8000 // 8 segundos
const IS_DEV = import.meta.env.DEV

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.message.includes('aborted'))
  )
}

/**
 * Hook para obtener el rol del usuario actual desde public.profiles
 * Lee userId desde useAuth() (NO llama getSession directamente)
 */
export function useUserRole(): UseUserRoleResult {
  const { user } = useAuth()
  const [role, setRole] = useState<UserRole>('advisor')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const lastUserIdRef = useRef<string | null>(null)
  const loadInProgressRef = useRef(false)

  const loadUserRole = useCallback(async (userId: string) => {
    // Prevenir ejecución múltiple
    if (loadInProgressRef.current) {
      if (IS_DEV) {
        console.debug('[useUserRole] loadUserRole ya en progreso, ignorando')
      }
      return
    }
    loadInProgressRef.current = true

    let timeoutId: number | null = null

    try {
      if (IS_DEV) {
        console.debug('[useUserRole] loadUserRole iniciado para userId:', userId)
      }

      // Timeout de seguridad
      timeoutId = window.setTimeout(() => {
        if (mountedRef.current && loadInProgressRef.current) {
          if (IS_DEV) {
            console.debug('[useUserRole] Timeout al cargar rol')
          }
          if (mountedRef.current) {
            setError('timeout')
            setLoading(false)
            loadInProgressRef.current = false
          }
        }
      }, ROLE_TIMEOUT_MS)

      // Evitar recargar si es el mismo usuario
      if (lastUserIdRef.current === userId && !error) {
        if (IS_DEV) {
          console.debug('[useUserRole] Mismo usuario, saltando recarga')
        }
        if (timeoutId) clearTimeout(timeoutId)
        loadInProgressRef.current = false
        return
      }

      lastUserIdRef.current = userId

      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }

      // Cargar role desde public.profiles usando user_id
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role, full_name, display_name, user_id')
        .eq('user_id', userId)
        .single()

      if (!mountedRef.current) {
        loadInProgressRef.current = false
        return
      }

      // Manejar AbortError
      if (profileError && isAbortError(profileError)) {
        if (IS_DEV) {
          console.debug('[useUserRole] AbortError en query profiles (ignorado)')
        }
        loadInProgressRef.current = false
        return
      }

      // Si no existe row en profiles: fallback a advisor (no bloqueante)
      if (profileError && profileError.code === 'PGRST116') {
        // PGRST116 = no rows found
        if (IS_DEV) {
          console.debug('[useUserRole] Perfil no encontrado, usando default: advisor')
        }
        if (mountedRef.current) {
          setRole('advisor')
          setError('profile_incomplete') // Para mostrar banner "Completa perfil"
          setLoading(false)
        }
        loadInProgressRef.current = false
        return
      }

      // Otros errores de query
      if (profileError) {
        console.warn('[useUserRole] Error al consultar profiles:', profileError)
        if (mountedRef.current) {
          setRole('advisor')
          setError(null)
          setLoading(false)
        }
        loadInProgressRef.current = false
        return
      }

      // Si profileData existe y tiene role
      if (profileData && profileData.role) {
        const userRole = profileData.role as UserRole
        // Validar que el role sea uno de los válidos
        const validRoles: UserRole[] = ['owner', 'manager', 'recruiter', 'advisor', 'director', 'seguimiento']
        const finalRole: UserRole = validRoles.includes(userRole) ? userRole : 'advisor'
        
        if (IS_DEV) {
          console.debug('[useUserRole] Rol obtenido desde profiles:', {
            userId,
            role: userRole,
            finalRole,
            canSeeConfig: finalRole === 'owner',
          })
        }

        if (mountedRef.current) {
          setRole(finalRole)
          setError(null)
          setLoading(false)
        }
        loadInProgressRef.current = false
        return
      }

      // Fallback: si no hay role en profile, usar advisor
      if (mountedRef.current) {
        setRole('advisor')
        setError('profile_incomplete')
        setLoading(false)
      }
      loadInProgressRef.current = false
    } catch (err) {
      if (!mountedRef.current) {
        if (timeoutId) clearTimeout(timeoutId)
        loadInProgressRef.current = false
        return
      }

      // Manejar AbortError en catch
      if (isAbortError(err)) {
        if (IS_DEV) {
          console.debug('[useUserRole] AbortError en catch (ignorado)')
        }
        if (timeoutId) clearTimeout(timeoutId)
        loadInProgressRef.current = false
        return
      }

      console.warn('[useUserRole] Error inesperado al cargar rol:', err)
      if (mountedRef.current) {
        setRole('advisor')
        setError(err instanceof Error ? err.message : 'Error al cargar rol')
        setLoading(false)
      }
      if (timeoutId) clearTimeout(timeoutId)
      loadInProgressRef.current = false
    }
  }, [error])

  const retry = useCallback(() => {
    if (IS_DEV) {
      console.debug('[useUserRole] Retry iniciado')
    }
    if (user?.id) {
      lastUserIdRef.current = null
      setError(null)
      setLoading(true)
      loadUserRole(user.id)
    }
  }, [loadUserRole, user])

  // Cargar rol cuando user cambia
  useEffect(() => {
    mountedRef.current = true

    if (!user?.id) {
      // Si no hay userId: setLoading(false), role='advisor', error='no_user'
      if (mountedRef.current) {
        setRole('advisor')
        setLoading(false)
        setError('no_user')
      }
      return
    }

    // Si hay userId, cargar rol
    loadUserRole(user.id)

    return () => {
      mountedRef.current = false
    }
  }, [user?.id, loadUserRole])

  return {
    role,
    isOwner: role === 'owner',
    canSeeConfig: role === 'owner',
    loading,
    error,
    retry,
  }
}
