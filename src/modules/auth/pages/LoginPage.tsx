import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabaseClient'
import { isNetworkError } from '../../../lib/supabaseErrorHandler'

const EMAIL_STORAGE_KEY = 'vant_last_email'

export function LoginPage() {
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
      navigate('/')
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
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <h1 className="text-3xl font-bold text-center mb-2">Bienvenido a Vant</h1>
          <p className="text-sm text-muted text-center mb-6">Inicia sesión para continuar</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-text mb-1.5">
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
                className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-text mb-1.5">
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
                  className="w-full border border-border rounded-md px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-text text-sm"
                  tabIndex={-1}
                >
                  {showPassword ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              {capsLockOn && (
                <div className="mt-1 text-xs text-warning flex items-center gap-1">
                  <span>⚠️</span>
                  <span>Caps Lock activado</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn btn-primary py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Cargando...' : isSignUp ? 'Crear acceso' : 'Iniciar sesión'}
            </button>

            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              disabled={loading}
              className="w-full text-sm text-primary hover:underline disabled:opacity-50"
            >
              {isSignUp ? 'Ya tengo acceso' : 'Crear acceso nuevo'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
