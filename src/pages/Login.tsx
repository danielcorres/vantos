import { useState } from 'react'
import { supabase } from '../lib/supabase'
import './Login.css'

export function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin + '/auth/callback',
        },
      })

      if (error) throw error

      setMessage('¡Revisa tu correo! Te hemos enviado un enlace mágico para iniciar sesión.')
    } catch (err: any) {
      setError(err.message || 'Error al enviar el enlace mágico')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1 className="login-title">vant-os</h1>
        <p className="login-subtitle">Inicia sesión con tu correo electrónico</p>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Correo electrónico</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}
          {message && <div className="success-message">{message}</div>}

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Enviando...' : 'Enviar enlace mágico'}
          </button>
        </form>
      </div>
    </div>
  )
}

