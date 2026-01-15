import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './AuthCallback.css'

export function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data, error: callbackError } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        )

        if (callbackError) {
          throw callbackError
        }

        if (data.session) {
          navigate('/activity', { replace: true })
        } else {
          throw new Error('No se pudo crear la sesión')
        }
      } catch (err: any) {
        setError(err.message || 'Error al procesar el enlace de autenticación')
        setLoading(false)
      }
    }

    handleCallback()
  }, [navigate])

  if (loading) {
    return (
      <div className="auth-callback-container">
        <div className="auth-callback-card">
          <h1>Verificando...</h1>
          <p>Procesando tu enlace de autenticación</p>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-callback-container">
      <div className="auth-callback-card">
        <h1>Error de autenticación</h1>
        {error && <div className="error-message">{error}</div>}
        <a href="/login" className="back-link">
          Volver al inicio de sesión
        </a>
      </div>
    </div>
  )
}

