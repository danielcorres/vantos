import { useState, useEffect, useMemo } from 'react'
import { getMyProfile, upsertMyProfile, type Profile } from '../lib/profile'
import { Toast } from '../shared/components/Toast'
import { useUserRole } from '../shared/hooks/useUserRole'

/** Quién puede editar datos de hitos de asesor en Mi perfil. */
const ROLES_EDIT_PROFILE_MILESTONE = new Set(['developer', 'recruiter', 'manager'])

function canEditMilestoneFields(role: string | null | undefined): boolean {
  return ROLES_EDIT_PROFILE_MILESTONE.has((role ?? '').toLowerCase().trim())
}

type AdvisorStatusValue = 'asesor_12_meses' | 'nueva_generacion' | 'consolidado' | ''

function advisorStatusLabel(v: string | null | undefined): string {
  switch (v) {
    case 'asesor_12_meses':
      return 'Asesor 12 meses'
    case 'nueva_generacion':
      return 'Nueva generación'
    case 'consolidado':
      return 'Consolidado'
    default:
      return '—'
  }
}

function formatBirthDisplay(ymd: string): string {
  if (!ymd || ymd.length < 10) return '—'
  const [y, m, d] = ymd.slice(0, 10).split('-')
  if (!y || !m || !d) return '—'
  return `${d}/${m}/${y}`
}

const VALID_ADVISOR_STATUS = new Set(['asesor_12_meses', 'nueva_generacion', 'consolidado'])

export function ProfilePage() {
  const { role, loading: roleLoading } = useUserRole()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [advisorCode, setAdvisorCode] = useState('')
  const [keyActivationDate, setKeyActivationDate] = useState('')
  const [connectionDate, setConnectionDate] = useState('')
  const [advisorStatus, setAdvisorStatus] = useState<AdvisorStatusValue>('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const roleForPerm = useMemo(() => {
    if (profile !== null) return profile.role
    if (!roleLoading) return role
    return null
  }, [profile, role, roleLoading])

  const canEditMilestone = useMemo(() => canEditMilestoneFields(roleForPerm), [roleForPerm])

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
        setBirthDate(data.birth_date ?? '')
        setAdvisorCode(data.advisor_code ?? '')
        setKeyActivationDate(data.key_activation_date ?? '')
        setConnectionDate(data.connection_date ?? '')
        setAdvisorStatus((data.advisor_status as AdvisorStatusValue) ?? '')
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
    const hasName = Boolean(firstName.trim() || lastName.trim())
    const hasBirth = Boolean(birthDate.trim())
    const hasMilestone =
      Boolean(advisorCode.trim()) ||
      Boolean(keyActivationDate.trim()) ||
      Boolean(connectionDate.trim()) ||
      Boolean(advisorStatus.trim())

    if (!hasName && !hasBirth && !(canEditMilestone && hasMilestone)) {
      setToast({
        type: 'error',
        message: canEditMilestone
          ? 'Ingresa al menos nombre, apellido, fecha de nacimiento o algún dato de hitos'
          : 'Ingresa al menos un nombre, un apellido o tu fecha de nacimiento',
      })
      return
    }

    if (canEditMilestone && advisorStatus.trim() && !VALID_ADVISOR_STATUS.has(advisorStatus.trim())) {
      setToast({
        type: 'error',
        message: 'Estatus de asesor no válido',
      })
      return
    }

    if (canEditMilestone && keyActivationDate.trim() && connectionDate.trim()) {
      if (keyActivationDate.trim() > connectionDate.trim()) {
        setToast({
          type: 'error',
          message: 'La fecha de alta de clave no puede ser posterior a la fecha de conexión',
        })
        return
      }
    }

    setSaving(true)
    setToast(null)

    try {
      const updated = await upsertMyProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        birth_date: birthDate.trim() || null,
        ...(canEditMilestone
          ? {
              milestone: {
                advisor_code: advisorCode.trim() || null,
                key_activation_date: keyActivationDate.trim() || null,
                connection_date: connectionDate.trim() || null,
                advisor_status: advisorStatus.trim() || null,
              },
            }
          : {}),
      })
      setProfile(updated)
      setBirthDate(updated.birth_date ?? '')
      setAdvisorCode(updated.advisor_code ?? '')
      setKeyActivationDate(updated.key_activation_date ?? '')
      setConnectionDate(updated.connection_date ?? '')
      setAdvisorStatus((updated.advisor_status as AdvisorStatusValue) ?? '')
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

  const inputClass =
    'w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary'
  const inputReadOnlyClass =
    'w-full border border-border rounded-md px-3 py-2 text-sm bg-black/[0.04] text-text cursor-default'

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold mb-1">Mi perfil</h1>
        <p className="text-sm text-muted">Actualiza tu información personal. Los datos de hitos pueden tener permisos distintos.</p>
      </div>

      <div className="card p-6">
        <div className="mb-6 pb-4 border-b border-border">
          <div className="text-xs text-muted mb-1">Nombre completo</div>
          <div className="text-lg font-semibold">{displayName}</div>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-muted -mt-1 mb-2">
            Al pulsar <span className="font-medium text-text">Guardar</span> se actualizan los campos editables a la vez.
          </p>

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
              className={inputClass}
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
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="birthDate" className="block text-sm font-medium text-text mb-1.5">
              Fecha de nacimiento
            </label>
            <input
              id="birthDate"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className={inputClass}
            />
            <p className="text-xs text-muted mt-1.5">Opcional. Uso interno (hitos, reportes).</p>
          </div>

          <div className="pt-4 border-t border-border space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-text">Datos de asesor (hitos)</h2>
              {canEditMilestone ? (
                <p className="text-xs text-muted mt-1">
                  Código, alta de clave, conexión y estatus. Visible para todos; solo manager, reclutador o desarrollador
                  pueden editarlos aquí.
                </p>
              ) : (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mt-2">
                  Solo lectura. Si necesitas cambiar estos datos, pídeselo a tu manager, reclutador o desarrollador.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="advisorCode" className="block text-sm font-medium text-text mb-1.5">
                Código de asesor
              </label>
              {canEditMilestone ? (
                <input
                  id="advisorCode"
                  type="text"
                  value={advisorCode}
                  onChange={(e) => setAdvisorCode(e.target.value)}
                  placeholder="Ej. ASE-001"
                  className={inputClass}
                />
              ) : (
                <div id="advisorCode" className={inputReadOnlyClass}>
                  {advisorCode.trim() || '—'}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="keyActivationDate" className="block text-sm font-medium text-text mb-1.5">
                Fecha de alta de clave
              </label>
              {canEditMilestone ? (
                <input
                  id="keyActivationDate"
                  type="date"
                  value={keyActivationDate}
                  onChange={(e) => setKeyActivationDate(e.target.value)}
                  className={inputClass}
                />
              ) : (
                <div id="keyActivationDate" className={inputReadOnlyClass}>
                  {formatBirthDisplay(keyActivationDate)}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="connectionDate" className="block text-sm font-medium text-text mb-1.5">
                Fecha de conexión
              </label>
              {canEditMilestone ? (
                <input
                  id="connectionDate"
                  type="date"
                  value={connectionDate}
                  onChange={(e) => setConnectionDate(e.target.value)}
                  className={inputClass}
                />
              ) : (
                <div id="connectionDate" className={inputReadOnlyClass}>
                  {formatBirthDisplay(connectionDate)}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="advisorStatus" className="block text-sm font-medium text-text mb-1.5">
                Estatus del asesor
              </label>
              {canEditMilestone ? (
                <select
                  id="advisorStatus"
                  value={advisorStatus}
                  onChange={(e) => setAdvisorStatus(e.target.value as AdvisorStatusValue)}
                  className={inputClass}
                >
                  <option value="">—</option>
                  <option value="asesor_12_meses">Asesor 12 meses</option>
                  <option value="nueva_generacion">Nueva generación</option>
                  <option value="consolidado">Consolidado</option>
                </select>
              ) : (
                <div id="advisorStatus" className={inputReadOnlyClass}>
                  {advisorStatusLabel(advisorStatus)}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
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
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
