import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import { isNetworkError } from '../../../lib/supabaseErrorHandler'
import { useAuth } from '../useAuth'
import { getHomePathForRole } from '../getHomePathForRole'
import { LoginBranding } from '../../../components/auth/LoginBranding'
import {
  ACCESS_BLOCKED_DEFAULT_MESSAGE,
  ACCESS_BLOCKED_FLASH_KEY,
} from '../../../shared/auth/accessBlockedFlash'

const EMAIL_STORAGE_KEY = 'vant_last_email'
const FORGOT_COOLDOWN_SECONDS = 45
const RESEND_CONFIRM_COOLDOWN_SECONDS = 60

function isEmailNotConfirmedError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
  const m = err.message.toLowerCase()
  return m.includes('email not confirmed') || m.includes('email_not_confirmed')
}

type Mode = 'login' | 'register' | 'forgot'

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
  const sessionUserId = session?.user?.id ?? null
  const [email, setEmail] = useState(() => {
    // Cargar email guardado del localStorage
    const savedEmail = localStorage.getItem(EMAIL_STORAGE_KEY)
    return savedEmail || ''
  })
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [capsLockOn, setCapsLockOn] = useState(false)
  const [mode, setMode] = useState<Mode>('login')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [signupSuccess, setSignupSuccess] = useState(false)
  const [signupAwaitingEmail, setSignupAwaitingEmail] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendLoading, setResendLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false)
  const [forgotCooldownRemaining, setForgotCooldownRemaining] = useState(0)
  const [forgotCooldownActive, setForgotCooldownActive] = useState(false)
  const [forgotNotice, setForgotNotice] = useState<string | null>(null)
  const forgotEmailRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // Si ya está autenticado en /login, redirigir a next o getHomePathForRole(role)
  useEffect(() => {
    if (!sessionUserId || role == null || authLoading) return
    const dest = isSafeNext(next) ? next : getHomePathForRole(role)
    navigate(dest, { replace: true })
  }, [sessionUserId, role, authLoading, next, navigate])

  // Guardar email en localStorage cuando cambia
  useEffect(() => {
    if (email) {
      localStorage.setItem(EMAIL_STORAGE_KEY, email)
    }
  }, [email])

  // Mensaje tras suspensión (AuthProvider) o ?reason=suspended
  useEffect(() => {
    const flash = sessionStorage.getItem(ACCESS_BLOCKED_FLASH_KEY)
    if (flash) {
      setError(flash)
      sessionStorage.removeItem(ACCESS_BLOCKED_FLASH_KEY)
    }
    const reason = searchParams.get('reason')
    if (reason === 'suspended') {
      setError((prev) => prev ?? ACCESS_BLOCKED_DEFAULT_MESSAGE)
      const nextParam = searchParams.get('next')
      const qs =
        nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
          ? `?next=${encodeURIComponent(nextParam)}`
          : ''
      navigate(`/login${qs}`, { replace: true })
    }
  }, [searchParams, navigate])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const id = setInterval(() => {
      setResendCooldown((c) => Math.max(0, c - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [resendCooldown])

  // Autofocus input de email al entrar en modo forgot
  useEffect(() => {
    if (mode === 'forgot') {
      forgotEmailRef.current?.focus()
    }
  }, [mode])

  // Cooldown: un solo interval mientras esté activo; cleanup al desactivar
  useEffect(() => {
    if (!forgotCooldownActive) return
    const id = setInterval(() => {
      setForgotCooldownRemaining((prev) => {
        const next = Math.max(0, prev - 1)
        if (next === 0) setForgotCooldownActive(false)
        return next
      })
    }, 1000)
    return () => clearInterval(id)
  }, [forgotCooldownActive])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === 'register') {
        // Validar nombre y apellido en sign up
        if (!firstName.trim() || !lastName.trim()) {
          setError('Nombre y apellido son requeridos')
          setLoading(false)
          return
        }

        const redirectTo = `${window.location.origin}/auth/callback`
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectTo,
            data: {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
            },
          },
        })
        if (error) throw error

        if (signUpData.session) {
          // Confirmación de email desactivada en el proyecto Supabase: la sesión ya existe.
          setSignupSuccess(false)
          setSignupAwaitingEmail(false)
        } else {
          setSignupSuccess(true)
          setSignupAwaitingEmail(!!signUpData.user)
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error

        // Navegar normalmente en sign in
        const dest = isSafeNext(next) ? next : '/'
        navigate(dest, { replace: true })
      }
    } catch (err: unknown) {
      let errorMessage = 'Error al autenticar'

      if (err instanceof Error) {
        if (isEmailNotConfirmedError(err)) {
          errorMessage =
            'Debes confirmar tu correo antes de entrar. Revisa tu bandeja (y spam) o usa «Reenviar confirmación».'
        } else if (err.message.includes('Invalid login credentials')) {
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

  const handleBackToSignIn = () => {
    setMode('login')
    setSignupSuccess(false)
    setSignupAwaitingEmail(false)
    setResendCooldown(0)
    setFirstName('')
    setLastName('')
    setPassword('')
    setError(null)
  }

  const handleResendSignupEmail = async () => {
    const trimmed = email.trim()
    if (!trimmed || resendCooldown > 0 || resendLoading) return
    setResendLoading(true)
    setError(null)
    try {
      const { error: resErr } = await supabase.auth.resend({
        type: 'signup',
        email: trimmed,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (resErr) throw resErr
      setResendCooldown(RESEND_CONFIRM_COOLDOWN_SECONDS)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo reenviar el correo')
    } finally {
      setResendLoading(false)
    }
  }

  const handleBackToLoginFromForgot = () => {
    setPassword('')
    setError(null)
    setForgotCooldownRemaining(0)
    setForgotCooldownActive(false)
    setForgotNotice(null)
    setMode('login')
  }

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError('Ingresa tu correo para restablecer la contraseña.')
      return
    }
    setError(null)
    setForgotNotice(null)
    setForgotPasswordLoading(true)
    try {
      await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/auth/reset`,
      })
      setForgotNotice('Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.')
      setForgotCooldownRemaining(FORGOT_COOLDOWN_SECONDS)
      setForgotCooldownActive(true)
    } catch {
      // No revelar si el correo existe
    } finally {
      setForgotPasswordLoading(false)
    }
  }

  const isForgotCooldown = forgotCooldownRemaining > 0

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md flex flex-col items-center">
        <LoginBranding mode="dark" className="mb-6" />
        <div className="w-full p-8 rounded-2xl bg-slate-900/60 backdrop-blur shadow-lg ring-1 ring-white/15 text-slate-100">
          <h1 className="text-2xl font-bold text-center mb-2 text-slate-100">
            {mode === 'forgot' ? 'Restablecer contraseña' : 'Bienvenido a Vant'}
          </h1>
          <p className="text-sm text-slate-400 text-center mb-6">
            {signupSuccess
              ? signupAwaitingEmail
                ? 'Confirma tu correo'
                : 'Cuenta lista'
              : mode === 'forgot'
                ? 'Ingresa tu correo y te enviaremos un enlace para restablecer tu contraseña.'
                : mode === 'register'
                  ? 'Crea tu cuenta'
                  : 'Inicia sesión para continuar'}
          </p>

          {signupSuccess ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-950/60 border border-green-800/60 rounded-md text-sm text-green-200">
                <p className="font-semibold mb-1">¡Registro exitoso!</p>
                {signupAwaitingEmail ? (
                  <p>
                    Revisa tu correo en <strong>{email}</strong> y abre el enlace de confirmación para activar tu
                    cuenta. Si no llega nada, revisa spam o reenvía el mensaje.
                  </p>
                ) : (
                  <p>Tu cuenta está activa. Puedes iniciar sesión con el correo y la contraseña que elegiste.</p>
                )}
              </div>
              {signupAwaitingEmail && (
                <button
                  type="button"
                  onClick={() => void handleResendSignupEmail()}
                  disabled={resendLoading || resendCooldown > 0}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold bg-slate-800 text-slate-100 ring-1 ring-white/10 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {resendLoading
                    ? 'Enviando…'
                    : resendCooldown > 0
                      ? `Reenviar en ${resendCooldown}s`
                      : 'Reenviar correo de confirmación'}
                </button>
              )}
              <button
                type="button"
                onClick={handleBackToSignIn}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-slate-800 text-slate-100 ring-1 ring-white/10 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors"
              >
                Volver a iniciar sesión
              </button>
            </div>
          ) : mode === 'forgot' ? (
            <div className="space-y-4">
              {error && (
                <div className="p-3 bg-red-950/60 border border-red-800/60 rounded-md text-sm text-red-200">
                  {error}
                </div>
              )}
              <div>
                <label htmlFor="forgot-email" className="block text-sm font-medium text-slate-300 mb-1.5">
                  Correo electrónico
                </label>
                <input
                  ref={forgotEmailRef}
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      if (!forgotPasswordLoading && forgotCooldownRemaining <= 0) {
                        handleForgotPassword()
                      }
                    }
                  }}
                  placeholder="tu@email.com"
                  disabled={forgotPasswordLoading}
                  className="w-full bg-slate-900 text-slate-100 ring-1 ring-white/10 rounded-md px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  autoComplete="email"
                />
              </div>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={forgotPasswordLoading || isForgotCooldown}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-slate-800 text-slate-100 ring-1 ring-white/10 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {forgotPasswordLoading ? 'Enviando...' : isForgotCooldown ? `Puedes reenviar en ${forgotCooldownRemaining}s` : 'Enviar enlace'}
              </button>
              {forgotNotice && (
                <div className="p-3 bg-slate-800/50 border border-slate-600/50 rounded-md text-sm text-slate-300">
                  {forgotNotice}
                </div>
              )}
              <button
                type="button"
                onClick={handleBackToLoginFromForgot}
                className="w-full text-sm text-slate-400 hover:text-slate-200 hover:underline transition-colors"
              >
                Volver a iniciar sesión
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-950/60 border border-red-800/60 rounded-md text-sm text-red-200">
                  {error}
                </div>
              )}

              {mode === 'register' && (
                <>
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-slate-300 mb-1.5">
                      Nombre
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Juan"
                      required
                      disabled={loading}
                      className="w-full bg-slate-900 text-slate-100 ring-1 ring-white/10 rounded-md px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      autoComplete="given-name"
                    />
                  </div>

                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-slate-300 mb-1.5">
                      Apellido
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Pérez"
                      required
                      disabled={loading}
                      className="w-full bg-slate-900 text-slate-100 ring-1 ring-white/10 rounded-md px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
                      autoComplete="family-name"
                    />
                  </div>
                </>
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
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
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
              {loading ? 'Cargando...' : mode === 'register' ? 'Crear acceso' : 'Iniciar sesión'}
            </button>

              {mode === 'login' && (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      setForgotCooldownRemaining(0)
                      setForgotCooldownActive(false)
                      setForgotNotice(null)
                      setPassword('')
                      setMode('forgot')
                    }}
                    disabled={loading}
                    className="w-full text-sm text-slate-400 hover:text-slate-200 hover:underline disabled:opacity-50 transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleResendSignupEmail()}
                    disabled={loading || !email.trim() || resendLoading || resendCooldown > 0}
                    className="w-full text-sm text-slate-400 hover:text-slate-200 hover:underline disabled:opacity-50 transition-colors"
                  >
                    {resendLoading
                      ? 'Enviando…'
                      : resendCooldown > 0
                        ? `Reenviar confirmación en ${resendCooldown}s`
                        : 'Reenviar correo de confirmación'}
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'register' ? 'login' : 'register')
                  setSignupSuccess(false)
                  setSignupAwaitingEmail(false)
                  setResendCooldown(0)
                  setFirstName('')
                  setLastName('')
                  setError(null)
                }}
                disabled={loading}
                className="w-full text-sm text-slate-400 hover:text-slate-200 hover:underline disabled:opacity-50 transition-colors"
              >
                {mode === 'register' ? 'Ya tengo acceso' : 'Crear acceso nuevo'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
