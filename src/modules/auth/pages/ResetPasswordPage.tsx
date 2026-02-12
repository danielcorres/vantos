import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../../lib/supabaseClient'
import { LoginBranding } from '../../../components/auth/LoginBranding'

const MIN_PASSWORD_LENGTH = 8

export function ResetPasswordPage() {
  const [ready, setReady] = useState(false)
  const [canReset, setCanReset] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    const checkRecovery = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (mountedRef.current && session) {
        setCanReset(true)
      }
      if (mountedRef.current) {
        setReady(true)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && mountedRef.current) {
        setCanReset(true)
      }
      if (mountedRef.current) {
        setReady(true)
      }
    })

    checkRecovery()

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
    }
  }, [])

  const passwordValid = password.length >= MIN_PASSWORD_LENGTH
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0
  const formValid = passwordValid && passwordsMatch

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!formValid) return

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError

      setSuccess(true)
      setTimeout(() => {
        navigate('/login', { replace: true })
      }, 1500)
    } catch {
      setError('No se pudo actualizar la contraseña. El enlace puede haber expirado.')
    } finally {
      setLoading(false)
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md flex flex-col items-center">
          <LoginBranding mode="dark" className="mb-6" />
          <div className="w-full p-8 rounded-2xl bg-slate-900/60 backdrop-blur shadow-lg ring-1 ring-white/15 text-slate-100 text-center">
            <p className="text-slate-400">Validando enlace...</p>
          </div>
        </div>
      </div>
    )
  }

  if (ready && !canReset) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md flex flex-col items-center">
          <LoginBranding mode="dark" className="mb-6" />
          <div className="w-full p-8 rounded-2xl bg-slate-900/60 backdrop-blur shadow-lg ring-1 ring-white/15 text-slate-100 text-center">
            <p className="text-slate-400 mb-4">Enlace inválido o expirado.</p>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="w-full py-2.5 rounded-lg text-sm font-semibold bg-slate-800 text-slate-100 ring-1 ring-white/10 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors"
            >
              Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col items-center">
        <LoginBranding mode="dark" className="mb-6" />
        <div className="w-full p-8 rounded-2xl bg-slate-900/60 backdrop-blur shadow-lg ring-1 ring-white/15 text-slate-100">
          <h1 className="text-2xl font-bold text-center mb-2 text-slate-100">Nueva contraseña</h1>
          <p className="text-sm text-slate-400 text-center mb-6">
            Elige una contraseña segura (mínimo 8 caracteres).
          </p>

          {success ? (
            <div className="p-4 bg-green-950/60 border border-green-800/60 rounded-md text-sm text-green-200 text-center">
              <p className="font-semibold">Contraseña actualizada.</p>
              <p className="mt-1">Redirigiendo al inicio de sesión...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-950/60 border border-red-800/60 rounded-md text-sm text-red-200">
                  {error}
                </div>
              )}

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Nueva contraseña
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 8 caracteres"
                    minLength={MIN_PASSWORD_LENGTH}
                    disabled={loading}
                    className="w-full bg-slate-900 text-slate-100 ring-1 ring-white/10 rounded-md px-3 py-2 pr-10 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    autoComplete="new-password"
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
                {password.length > 0 && password.length < MIN_PASSWORD_LENGTH && (
                  <p className="mt-1 text-xs text-amber-300">Mínimo {MIN_PASSWORD_LENGTH} caracteres</p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Confirmar contraseña
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite la contraseña"
                  disabled={loading}
                  className="w-full bg-slate-900 text-slate-100 ring-1 ring-white/10 rounded-md px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  autoComplete="new-password"
                />
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="mt-1 text-xs text-amber-300">Las contraseñas no coinciden</p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !formValid}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-slate-800 text-slate-100 ring-1 ring-white/10 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Guardando...' : 'Guardar contraseña'}
              </button>

              <button
                type="button"
                onClick={() => navigate('/login', { replace: true })}
                disabled={loading}
                className="w-full text-sm text-slate-400 hover:text-slate-200 hover:underline disabled:opacity-50 transition-colors"
              >
                Volver al inicio de sesión
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
