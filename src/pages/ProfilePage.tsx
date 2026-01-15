import { useState, useEffect } from 'react'
import { getMyProfile, upsertMyProfile, type Profile } from '../lib/profile'
import { Toast } from '../shared/components/Toast'

export function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    setLoading(true)
    try {
      const data = await getMyProfile()
      setProfile(data)
      if (data) {
        setFirstName(data.first_name || '')
        setLastName(data.last_name || '')
      }
    } catch (err) {
      console.error('Error al cargar perfil:', err)
      setToast({
        type: 'error',
        message: 'Error al cargar tu perfil',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!firstName.trim() && !lastName.trim()) {
      setToast({
        type: 'error',
        message: 'Ingresa al menos un nombre o apellido',
      })
      return
    }

    setSaving(true)
    setToast(null)

    try {
      const updated = await upsertMyProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      })
      setProfile(updated)
      setToast({
        type: 'success',
        message: 'Perfil guardado ✅',
      })
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar perfil'
      setToast({
        type: 'error',
        message: errorMessage,
      })
    } finally {
      setSaving(false)
      setTimeout(() => setToast(null), 3000)
    }
  }

  if (loading) {
    return (
      <div className="text-center p-8">
        <span className="text-muted">Cargando...</span>
      </div>
    )
  }

  const displayName = profile?.full_name?.trim() || 'Sin nombre'

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold mb-1">Mi perfil</h1>
        <p className="text-sm text-muted">Actualiza tu información personal</p>
      </div>

      {/* Card de perfil */}
      <div className="card p-6">
        {/* Nombre completo actual */}
        <div className="mb-6 pb-4 border-b border-border">
          <div className="text-xs text-muted mb-1">Nombre completo</div>
          <div className="text-lg font-semibold">{displayName}</div>
        </div>

        {/* Formulario */}
        <div className="space-y-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-text mb-1.5">
              Nombre
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Tu nombre"
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-text mb-1.5">
              Apellido
            </label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Tu apellido"
              className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary px-6 py-2.5"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
