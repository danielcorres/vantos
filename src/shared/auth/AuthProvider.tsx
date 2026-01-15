import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { getSystemOwnerId, clearSystemOwnerCache } from '../../lib/systemOwner'
import type { User, Session, AuthError } from '@supabase/supabase-js'

const IS_DEV = import.meta.env.DEV

type UserRole = 'advisor' | 'manager' | 'recruiter' | 'owner'

interface AuthContextType {
  user: User | null
  session: Session | null
  role: UserRole | null
  systemOwnerId: string | null
  loading: boolean
  error: string | null
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.message.includes('aborted'))
  )
}

function isAuthError(error: unknown): error is AuthError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    'status' in error
  )
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [systemOwnerId, setSystemOwnerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const didInitRef = useRef(false)
  const roleLoadInProgressRef = useRef(false)
  const lastUserIdRef = useRef<string | null>(null)

  const loadUserRole = useCallback(async (userId: string) => {
    // Prevenir ejecución múltiple
    if (roleLoadInProgressRef.current) {
      if (IS_DEV) {
        console.debug('[AuthProvider] loadUserRole ya en progreso, ignorando')
      }
      return
    }
    roleLoadInProgressRef.current = true

    try {
      if (IS_DEV) {
        console.debug('[AuthProvider] Cargando role para userId:', userId)
      }

      // Cargar role desde public.profiles usando user_id
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role, user_id')
        .eq('user_id', userId)
        .single()

      if (!mountedRef.current) {
        roleLoadInProgressRef.current = false
        return
      }

      // Manejar AbortError
      if (profileError && isAbortError(profileError)) {
        if (IS_DEV) {
          console.debug('[AuthProvider] AbortError en query profiles (ignorado)')
        }
        roleLoadInProgressRef.current = false
        return
      }

      // Si no existe row en profiles: fallback a advisor
      if (profileError && profileError.code === 'PGRST116') {
        // PGRST116 = no rows found
        if (IS_DEV) {
          console.debug('[AuthProvider] Perfil no encontrado, usando default: advisor')
        }
        if (mountedRef.current) {
          setRole('advisor')
        }
        roleLoadInProgressRef.current = false
        return
      }

      // Otros errores de query: fallback a advisor
      if (profileError) {
        console.warn('[AuthProvider] Error al consultar profiles:', profileError)
        if (mountedRef.current) {
          setRole('advisor')
        }
        roleLoadInProgressRef.current = false
        return
      }

      // Si profileData existe y tiene role
      if (profileData && profileData.role) {
        const userRole = profileData.role as UserRole
        // Validar que el role sea uno de los válidos
        const validRoles: UserRole[] = ['owner', 'manager', 'recruiter', 'advisor']
        const finalRole: UserRole = validRoles.includes(userRole) ? userRole : 'advisor'
        
        if (IS_DEV) {
          console.debug('[AuthProvider] Rol obtenido desde profiles:', {
            userId,
            role: userRole,
            finalRole,
          })
        }

        if (mountedRef.current) {
          setRole(finalRole)
        }
        roleLoadInProgressRef.current = false
        return
      }

      // Fallback: si no hay role en profile, usar advisor
      if (mountedRef.current) {
        setRole('advisor')
      }
      roleLoadInProgressRef.current = false
    } catch (err) {
      if (!mountedRef.current) {
        roleLoadInProgressRef.current = false
        return
      }

      // Manejar AbortError en catch
      if (isAbortError(err)) {
        if (IS_DEV) {
          console.debug('[AuthProvider] AbortError en loadUserRole catch (ignorado)')
        }
        roleLoadInProgressRef.current = false
        return
      }

      console.warn('[AuthProvider] Error inesperado al cargar rol:', err)
      if (mountedRef.current) {
        setRole('advisor')
      }
      roleLoadInProgressRef.current = false
    }
  }, [])

  const loadSystemOwnerId = useCallback(async () => {
    if (!mountedRef.current) return
    
    try {
      const ownerId = await getSystemOwnerId()
      if (mountedRef.current) {
        setSystemOwnerId(ownerId)
        if (IS_DEV) {
          console.debug('[AuthProvider] System Owner ID cargado:', ownerId)
        }
      }
    } catch (err) {
      console.error('[AuthProvider] Error al cargar System Owner ID:', err)
      if (mountedRef.current) {
        setSystemOwnerId(null)
      }
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      clearSystemOwnerCache()
      lastUserIdRef.current = null
      if (mountedRef.current) {
        setUser(null)
        setSession(null)
        setRole(null)
        setSystemOwnerId(null)
        setError(null)
      }
    } catch (err) {
      // Si es AbortError, ignorarlo
      if (isAbortError(err)) {
        if (IS_DEV) {
          console.debug('[AuthProvider] AbortError en signOut (ignorado)')
        }
        return
      }
      console.warn('[AuthProvider] Error al cerrar sesión:', err)
      // Aún así, limpiar estado local
      clearSystemOwnerCache()
      lastUserIdRef.current = null
      if (mountedRef.current) {
        setUser(null)
        setSession(null)
        setRole(null)
        setSystemOwnerId(null)
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true

    // Prevenir doble ejecución en StrictMode
    if (didInitRef.current) {
      if (IS_DEV) {
        console.debug('[AuthProvider] Ya inicializado, saltando (StrictMode)')
      }
      return
    }
    didInitRef.current = true

    let aborted = false

    const initializeAuth = async () => {
      if (IS_DEV) {
        console.debug('[AuthProvider] Inicializando auth...')
      }

      try {
        // Una sola llamada a getSession()
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (aborted || !mountedRef.current) {
          if (IS_DEV) {
            console.debug('[AuthProvider] initializeAuth abortado o desmontado')
          }
          return
        }

        // Manejar AbortError
        if (sessionError && isAbortError(sessionError)) {
          if (IS_DEV) {
            console.debug('[AuthProvider] AbortError en getSession (ignorado)')
          }
          if (mountedRef.current) {
            setLoading(false)
          }
          return
        }

        // Manejar otros errores de auth
        if (sessionError || isAuthError(sessionError)) {
          if (IS_DEV) {
            console.debug('[AuthProvider] Error al obtener sesión:', sessionError)
          }
          if (mountedRef.current) {
            setUser(null)
            setSession(null)
            setError('Error de autenticación')
            setLoading(false)
          }
          return
        }

        // Actualizar estado con sesión
        if (mountedRef.current) {
          const currentUserId = session?.user?.id ?? null
          
          // Limpiar cache solo si cambió el userId
          if (currentUserId !== lastUserIdRef.current) {
            clearSystemOwnerCache()
            lastUserIdRef.current = currentUserId
          }
          
          setSession(session)
          setUser(session?.user ?? null)
          setError(null)
          setLoading(false)
          if (IS_DEV) {
            console.debug('[AuthProvider] Sesión inicial cargada:', { hasSession: !!session, userId: currentUserId })
          }
          
          // Cargar role y system owner si hay usuario
          if (currentUserId) {
            loadUserRole(currentUserId)
            loadSystemOwnerId()
          } else {
            // Si no hay sesión, limpiar system owner
            setSystemOwnerId(null)
          }
        }
      } catch (err) {
        if (aborted || !mountedRef.current) return

        // Manejar AbortError en catch
        if (isAbortError(err)) {
          if (IS_DEV) {
            console.debug('[AuthProvider] AbortError en initializeAuth catch (ignorado)')
          }
          if (mountedRef.current) {
            setLoading(false)
          }
          return
        }

        console.error('[AuthProvider] Error inesperado al inicializar auth:', err)
        if (mountedRef.current) {
          setUser(null)
          setSession(null)
          setError('Error al cargar autenticación')
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // Una sola suscripción a onAuthStateChange
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mountedRef.current || aborted) return

      if (IS_DEV) {
        console.debug('[AuthProvider] onAuthStateChange:', { event: _event, hasSession: !!newSession })
      }

      if (mountedRef.current) {
        const currentUserId = newSession?.user?.id ?? null
        
        // Limpiar cache solo si cambió el userId
        if (currentUserId !== lastUserIdRef.current) {
          clearSystemOwnerCache()
          lastUserIdRef.current = currentUserId
        }
        
        setSession(newSession)
        setUser(newSession?.user ?? null)
        setError(null)
        setLoading(false)
        
        // Cargar role y system owner si hay usuario
        if (currentUserId) {
          loadUserRole(currentUserId)
          loadSystemOwnerId()
        } else {
          // Si no hay sesión, limpiar role y system owner
          setRole(null)
          setSystemOwnerId(null)
        }
      }
    })

    return () => {
      aborted = true
      mountedRef.current = false
      didInitRef.current = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, session, role, systemOwnerId, loading, error, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
