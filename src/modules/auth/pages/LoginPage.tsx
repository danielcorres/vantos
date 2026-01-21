import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabaseClient'
import { isNetworkError } from '../../../lib/supabaseErrorHandler'
import { useAuth } from '../useAuth'
import { getHomePathForRole } from '../getHomePathForRole'
import { LoginBranding } from '../../../components/auth/LoginBranding'

const EMAIL_STORAGE_KEY = 'vant_last_email'

function isSafeNext(next: string | null): next is string {
  if (!next || typeof next !== 'string') return false
  if (!next.startsWith('/')) return false
  if (next.startsWith('//')) return false
  if (next.includes('://')) return false
  return true
}

export function LoginPage() {
  const [searchParams] = useSearchParams()
  const next = searchParams.get('next')
  const { session, role, loading: authLoading } = useAuth()
  const [email, setEmail] = useState(() => {
    // Cargar email guardado del localStorage
    const savedEmail = localStorage.getItem(EMAIL_STORAGE_KEY)
    return savedEmail || ''
  })
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // Si ya está autenticado en /login, redirigir a next o getHomePathForRole(role)
  useEffect(() => {
    if (!session || role == null || authLoading) return
    const dest = isSafeNext(next) ? next : getHomePathForRole(role)
    navigate(dest, { replace: true })
  }, [session, role, authLoading, next, navigate])

  // Guardar email en localStorage cuando cambia
  useEffect(() => {
    if (email) {
      localStorage.setItem(EMAIL_STORAGE_KEY, email)
    }
  }, [email])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      }
      const dest = isSafeNext(next) ? next : '/'
      navigate(dest, { replace: true })
    } catch (err: unknown) {
      let errorMessage = 'Error al autenticar'

      if (err instanceof Error) {
        // Mejorar mensajes de error
        if (err.message.includes('Invalid login credentials') || err.message.includes('Email not confirmed')) {
          errorMessage = 'Correo o contraseña incorrectos'
        } else if (isNetworkError(err)) {
          errorMessage = 'No se pudo conectar. Reintenta.'
        } else {
          errorMessage = err.message
        }
      }

      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col items-center">
        <LoginBranding mode="dark" className="mb-6" />
        <div className="w-full p-8 rounded-2xl bg-slate-900/50 backdrop-blur shadow-lg ring-1 ring-white/10">
          <h1 className="text-2xl font-bold text-center mb-2 text-slate-100">Bienvenido a Vant</h1>
          <p className="text-sm text-slate-400 text-center mb-6">Inicia sesión para continuar</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-950/60 border border-red-800/60 rounded-md text-sm text-red-200">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                required
                disabled={loading}
                className="w-full bg-slate-900 text-slate-100 ring-1 ring-white/10 rounded-md px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyUp={(e) => {
                    // Detectar Caps Lock
                    if (e.getModifierState && e.getModifierState('CapsLock')) {
                      setCapsLockOn(true)
                    } else {
                      setCapsLockOn(false)
                    }
                  }}
                  onKeyDown={(e) => {
                    // Detectar Caps Lock también en keyDown
                    if (e.getModifierState && e.getModifierState('CapsLock')) {
                      setCapsLockOn(true)
                    } else {
                      setCapsLockOn(false)
                    }
                  }}
                  required
                  disabled={loading}
                  className="w-full bg-slate-900 text-slate-100 ring-1 ring-white/10 rounded-md px-3 py-2 pr-10 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-sm"
                  tabIndex={-1}
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              {capsLockOn && (
                <div className="mt-1 text-xs text-amber-300 flex items-center gap-1">
                  <span>⚠️</span>
                  <span>Caps Lock activado</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold bg-slate-800 text-slate-100 ring-1 ring-white/10 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Cargando...' : isSignUp ? 'Crear acceso' : 'Iniciar sesión'}
            </button>

            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              disabled={loading}
              className="w-full text-sm text-slate-400 hover:text-slate-200 hover:underline disabled:opacity-50 transition-colors"
            >
              {isSignUp ? 'Ya tengo acceso' : 'Crear acceso nuevo'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
