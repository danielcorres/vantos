import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { EmailOtpType } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { getErrorMessage } from '../lib/supabaseErrorHandler'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { SuccessIcon } from '../components/feedback/SuccessIcon'
import './AuthCallback.css'

type CallbackStatus = 'loading' | 'success' | 'error'

const VALID_OTP_TYPES: ReadonlySet<EmailOtpType> = new Set<EmailOtpType>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
])

const SUCCESS_REDIRECT_MS = 3000

function parseHashParams(hash: string): URLSearchParams {
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash
  return new URLSearchParams(trimmed)
}

function readCallbackParams(): {
  tokenHash: string | null
  type: EmailOtpType | null
  code: string | null
  errorDescription: string | null
} {
  const search = new URLSearchParams(window.location.search)
  const hash = parseHashParams(window.location.hash)

  const tokenHash = search.get('token_hash') ?? hash.get('token_hash')
  const rawType = search.get('type') ?? hash.get('type')
  const code = search.get('code') ?? hash.get('code')
  const errorDescription =
    search.get('error_description') ?? hash.get('error_description') ?? search.get('error') ?? hash.get('error')

  const type = rawType && VALID_OTP_TYPES.has(rawType as EmailOtpType) ? (rawType as EmailOtpType) : null

  return { tokenHash, type, code, errorDescription }
}

export function AuthCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<CallbackStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    let redirectTimer: ReturnType<typeof setTimeout> | undefined

    const finishWithSuccess = () => {
      setStatus('success')
      redirectTimer = setTimeout(() => {
        navigate('/login', { replace: true })
      }, SUCCESS_REDIRECT_MS)
    }

    const finishWithError = (message: string) => {
      setError(message)
      setStatus('error')
    }

    const handleCallback = async () => {
      const { tokenHash, type, code, errorDescription } = readCallbackParams()

      if (errorDescription) {
        finishWithError(decodeURIComponent(errorDescription.replace(/\+/g, ' ')))
        return
      }

      try {
        if (tokenHash && type) {
          // Email confirmation flow (signup, recovery, invite, email_change, magiclink).
          // verifyOtp does NOT require a PKCE code_verifier in localStorage,
          // so it works across browsers/devices.
          const { error: otpError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
          })
          if (otpError) throw otpError

          if (type === 'recovery') {
            // Password recovery keeps the session active for ResetPasswordPage.
            navigate('/auth/reset', { replace: true })
            return
          }

          // For signup/invite/email_change we want the user to land on /login
          // with a clean state, so sign out the freshly-created session.
          await supabase.auth.signOut().catch(() => {})
          finishWithSuccess()
          return
        }

        if (code) {
          // OAuth / PKCE flow (Google, GitHub, etc.). Same browser is required
          // because the code_verifier was stored on signIn.
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(
            window.location.href
          )
          if (exchangeError) throw exchangeError
          if (!data.session) throw new Error('No se pudo crear la sesión')
          navigate('/', { replace: true })
          return
        }

        finishWithError('Enlace de autenticación inválido o incompleto.')
      } catch (err: unknown) {
        finishWithError(getErrorMessage(err) || 'Error al procesar el enlace de autenticación')
      }
    }

    handleCallback()

    return () => {
      if (redirectTimer) clearTimeout(redirectTimer)
    }
  }, [navigate])

  if (status === 'loading') {
    return (
      <div className="auth-callback-container">
        <div className="auth-callback-card animate-fade-in-up">
          <LoadingSpinner size={48} className="mb-6 text-[#667eea]" />
          <h1>Verificando...</h1>
          <p>Procesando tu enlace de autenticación</p>
        </div>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="auth-callback-container">
        <div className="auth-callback-card animate-fade-in-up">
          <SuccessIcon size={64} className="mb-5" />
          <h1>Correo confirmado correctamente</h1>
          <p>Tu cuenta ha sido verificada. Te llevaremos al inicio de sesión en unos segundos.</p>
          <button
            type="button"
            className="back-link"
            onClick={() => navigate('/login', { replace: true })}
          >
            Ir al inicio de sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-callback-container">
      <div className="auth-callback-card animate-fade-in-up">
        <h1>Error de autenticación</h1>
        {error && <div className="error-message">{error}</div>}
        <button
          type="button"
          className="back-link"
          onClick={() => navigate('/login', { replace: true })}
        >
          Volver al inicio de sesión
        </button>
      </div>
    </div>
  )
}
