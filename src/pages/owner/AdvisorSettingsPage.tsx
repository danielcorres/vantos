import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../shared/auth/AuthProvider'
import { useUserRole } from '../../shared/hooks/useUserRole'
import {
  deleteAdvisorLifePolicy,
  fetchAdvisorLifePolicies,
  insertAdvisorLifePolicy,
  updateAdvisorProfile,
  type AdvisorLifePolicy,
  type AdvisorMilestoneProfile,
} from '../../modules/advisors/data/advisorMilestones.api'
import { formatDateMX, todayLocalYmd } from '../../shared/utils/dates'

const EDITOR_ROLES = new Set(['owner', 'director', 'seguimiento', 'developer'])

type AdvisorStatusOption = 'asesor_12_meses' | 'nueva_generacion' | 'consolidado' | ''

type EditState = {
  birth_date: string
  advisor_code: string
  key_activation_date: string
  connection_date: string
  advisor_status: AdvisorStatusOption
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

function toEditState(p: AdvisorMilestoneProfile): EditState {
  return {
    birth_date: p.birth_date ?? '',
    advisor_code: p.advisor_code ?? '',
    key_activation_date: p.key_activation_date ?? '',
    connection_date: p.connection_date ?? '',
    advisor_status: (p.advisor_status as AdvisorStatusOption) ?? '',
  }
}

function equalsEdit(a: EditState, b: EditState): boolean {
  return (
    a.birth_date === b.birth_date &&
    a.advisor_code === b.advisor_code &&
    a.key_activation_date === b.key_activation_date &&
    a.connection_date === b.connection_date &&
    a.advisor_status === b.advisor_status
  )
}

function profileDisplayName(p: AdvisorMilestoneProfile): string {
  return (
    (p.full_name && p.full_name.trim()) ||
    (p.display_name && p.display_name.trim()) ||
    `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() ||
    p.user_id.slice(0, 8)
  )
}

export function AdvisorSettingsPage() {
  const { user } = useAuth()
  const { role, loading: roleLoading } = useUserRole()
  const canEdit = role != null && EDITOR_ROLES.has(role)

  const [advisors, setAdvisors] = useState<AdvisorMilestoneProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [edit, setEdit] = useState<EditState | null>(null)
  const [initial, setInitial] = useState<EditState | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const [policies, setPolicies] = useState<AdvisorLifePolicy[]>([])
  const [policiesLoading, setPoliciesLoading] = useState(false)
  const [policiesError, setPoliciesError] = useState<string | null>(null)
  const [newPolicy, setNewPolicy] = useState({ paid_at: todayLocalYmd(), policy_number: '', notes: '' })
  const [addingPolicy, setAddingPolicy] = useState(false)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const loadAdvisors = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'user_id, full_name, display_name, first_name, last_name, birth_date, advisor_code, key_activation_date, connection_date, advisor_status, role'
        )
        .in('role', ['advisor'])
        .order('full_name', { ascending: true, nullsFirst: false })
      if (error) throw error
      if (!mountedRef.current) return
      setAdvisors((data ?? []) as AdvisorMilestoneProfile[])
      setLoading(false)
    } catch (err) {
      console.error('[AdvisorSettingsPage] Error al cargar asesores:', err)
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : 'Error al cargar asesores')
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!roleLoading && canEdit) loadAdvisors()
  }, [roleLoading, canEdit, loadAdvisors])

  const selectedAdvisor = useMemo(
    () => advisors.find((a) => a.user_id === selectedId) ?? null,
    [advisors, selectedId]
  )

  const loadPolicies = useCallback(async (advisorId: string) => {
    setPoliciesLoading(true)
    setPoliciesError(null)
    try {
      const rows = await fetchAdvisorLifePolicies(advisorId)
      if (!mountedRef.current) return
      setPolicies(rows)
      setPoliciesLoading(false)
    } catch (err) {
      console.error('[AdvisorSettingsPage] Error al cargar pólizas:', err)
      if (!mountedRef.current) return
      setPoliciesError(err instanceof Error ? err.message : 'Error al cargar pólizas')
      setPoliciesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedAdvisor) {
      setEdit(null)
      setInitial(null)
      setPolicies([])
      setSaveState('idle')
      setSaveError(null)
      return
    }
    const state = toEditState(selectedAdvisor)
    setEdit(state)
    setInitial(state)
    setSaveState('idle')
    setSaveError(null)
    loadPolicies(selectedAdvisor.user_id)
  }, [selectedAdvisor, loadPolicies])

  const dirty = edit && initial ? !equalsEdit(edit, initial) : false

  const handleSave = async () => {
    if (!selectedAdvisor || !edit) return
    setSaveState('saving')
    setSaveError(null)
    try {
      const payload = {
        birth_date: edit.birth_date || null,
        advisor_code: edit.advisor_code.trim() || null,
        key_activation_date: edit.key_activation_date || null,
        connection_date: edit.connection_date || null,
        advisor_status: edit.advisor_status || null,
      } as const

      if (edit.key_activation_date && edit.connection_date) {
        if (edit.key_activation_date > edit.connection_date) {
          setSaveState('error')
          setSaveError('La fecha de alta de clave no puede ser posterior a la fecha de conexión.')
          return
        }
      }

      const updated = await updateAdvisorProfile(selectedAdvisor.user_id, payload)
      if (!mountedRef.current) return

      setAdvisors((prev) =>
        prev.map((a) =>
          a.user_id === updated.user_id
            ? { ...a, ...updated }
            : a
        )
      )
      const nextState = toEditState({ ...selectedAdvisor, ...updated })
      setEdit(nextState)
      setInitial(nextState)
      setSaveState('saved')
      setTimeout(() => {
        if (mountedRef.current) setSaveState('idle')
      }, 2000)
    } catch (err) {
      console.error('[AdvisorSettingsPage] Error al guardar perfil:', err)
      if (!mountedRef.current) return
      setSaveState('error')
      setSaveError(err instanceof Error ? err.message : 'Error al guardar')
    }
  }

  const handleCancel = () => {
    if (initial) setEdit(initial)
    setSaveState('idle')
    setSaveError(null)
  }

  const handleAddPolicy = async () => {
    if (!selectedAdvisor) return
    if (!newPolicy.paid_at) {
      setPoliciesError('La fecha de pago es obligatoria.')
      return
    }
    setAddingPolicy(true)
    setPoliciesError(null)
    try {
      await insertAdvisorLifePolicy({
        advisor_user_id: selectedAdvisor.user_id,
        paid_at: newPolicy.paid_at,
        policy_number: newPolicy.policy_number.trim() || null,
        notes: newPolicy.notes.trim() || null,
        created_by: user?.id ?? null,
      })
      if (!mountedRef.current) return
      setNewPolicy({ paid_at: todayLocalYmd(), policy_number: '', notes: '' })
      await loadPolicies(selectedAdvisor.user_id)
    } catch (err) {
      console.error('[AdvisorSettingsPage] Error al agregar póliza:', err)
      if (!mountedRef.current) return
      setPoliciesError(err instanceof Error ? err.message : 'Error al agregar póliza')
    } finally {
      if (mountedRef.current) setAddingPolicy(false)
    }
  }

  const handleDeletePolicy = async (id: string) => {
    if (!selectedAdvisor) return
    const confirmed = window.confirm('¿Eliminar esta póliza registrada?')
    if (!confirmed) return
    try {
      await deleteAdvisorLifePolicy(id)
      if (!mountedRef.current) return
      await loadPolicies(selectedAdvisor.user_id)
    } catch (err) {
      console.error('[AdvisorSettingsPage] Error al eliminar póliza:', err)
      if (!mountedRef.current) return
      setPoliciesError(err instanceof Error ? err.message : 'Error al eliminar póliza')
    }
  }

  if (roleLoading) {
    return (
      <div className="text-center p-8">
        <span className="text-muted">Cargando…</span>
      </div>
    )
  }

  if (!canEdit) {
    return (
      <div className="text-center p-8">
        <div className="text-lg font-semibold mb-2">No autorizado</div>
        <div className="text-sm text-muted">
          Solo owner, director, seguimiento o developer pueden editar esta vista.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-text">Configuración de asesores</h1>
        <p className="text-sm text-muted mt-1">
          Datos de onboarding, estado del asesor y registro de pólizas de vida pagadas.
        </p>
      </div>

      {error && (
        <div className="card p-4 bg-red-50 border border-red-200">
          <div className="text-sm text-red-700">{error}</div>
          <button onClick={loadAdvisors} className="btn btn-primary mt-3 text-sm">
            Reintentar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lista */}
        <div className="card p-0 overflow-hidden">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold">Asesores</h2>
            <span className="text-xs text-muted">{advisors.length}</span>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-muted">Cargando…</div>
            ) : advisors.length === 0 ? (
              <div className="p-4 text-sm text-muted">Sin asesores.</div>
            ) : (
              <ul>
                {advisors.map((a) => {
                  const selected = a.user_id === selectedId
                  return (
                    <li key={a.user_id}>
                      <button
                        onClick={() => setSelectedId(a.user_id)}
                        type="button"
                        className={`w-full text-left px-3 py-2 border-b border-border transition-colors ${
                          selected ? 'bg-primary/10' : 'hover:bg-black/5'
                        }`}
                      >
                        <div className="text-sm font-medium text-text truncate">
                          {profileDisplayName(a)}
                        </div>
                        <div className="text-xs text-muted truncate">
                          {a.advisor_code || '—'} · {advisorStatusLabel(a.advisor_status)}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Formulario */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedAdvisor || !edit ? (
            <div className="card p-6 text-sm text-muted text-center">
              Selecciona un asesor para editar.
            </div>
          ) : (
            <>
              <div className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold">
                      {profileDisplayName(selectedAdvisor)}
                    </h2>
                    <p className="text-xs text-muted">
                      ID: <span className="font-mono">{selectedAdvisor.user_id.slice(0, 8)}…</span>
                    </p>
                  </div>
                  <div className="text-xs">
                    {saveState === 'saving' && <span className="text-muted">Guardando…</span>}
                    {saveState === 'saved' && <span className="text-green-700">Guardado</span>}
                    {saveState === 'error' && (
                      <span className="text-red-700">Error: {saveError}</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Field label="Fecha de nacimiento">
                    <input
                      type="date"
                      value={edit.birth_date}
                      onChange={(e) => setEdit({ ...edit, birth_date: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-border rounded bg-bg text-text"
                    />
                  </Field>

                  <Field label="Código de asesor">
                    <input
                      type="text"
                      value={edit.advisor_code}
                      onChange={(e) => setEdit({ ...edit, advisor_code: e.target.value })}
                      placeholder="Ej. ASE-001"
                      className="w-full px-3 py-2 text-sm border border-border rounded bg-bg text-text"
                    />
                  </Field>

                  <Field label="Fecha de alta de clave">
                    <input
                      type="date"
                      value={edit.key_activation_date}
                      onChange={(e) => setEdit({ ...edit, key_activation_date: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-border rounded bg-bg text-text"
                    />
                    <div className="text-[11px] text-muted mt-1">
                      Inicia la ventana de 90 días para al menos 6 pólizas (incluye precontrato en ese rango).
                    </div>
                  </Field>

                  <Field label="Fecha de conexión">
                    <input
                      type="date"
                      value={edit.connection_date}
                      onChange={(e) => setEdit({ ...edit, connection_date: e.target.value })}
                      className="w-full px-3 py-2 text-sm border border-border rounded bg-bg text-text"
                    />
                  </Field>

                  <Field label="Estatus del asesor">
                    <select
                      value={edit.advisor_status}
                      onChange={(e) =>
                        setEdit({ ...edit, advisor_status: e.target.value as AdvisorStatusOption })
                      }
                      className="w-full px-3 py-2 text-sm border border-border rounded bg-bg text-text"
                    >
                      <option value="">—</option>
                      <option value="asesor_12_meses">Asesor 12 meses</option>
                      <option value="nueva_generacion">Nueva generación</option>
                      <option value="consolidado">Consolidado</option>
                    </select>
                  </Field>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={!dirty || saveState === 'saving'}
                    className="px-3 py-1.5 text-sm border border-border rounded bg-bg text-text hover:bg-black/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!dirty || saveState === 'saving'}
                    className="btn btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saveState === 'saving' ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>
              </div>

              {/* Pólizas de vida pagadas */}
              <div className="card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Pólizas de vida pagadas</h3>
                  <span className="text-xs text-muted">{policies.length}</span>
                </div>

                {/* Formulario agregar */}
                <div className="grid grid-cols-1 md:grid-cols-[150px_1fr_1fr_auto] gap-2 items-end">
                  <Field label="Fecha pago">
                    <input
                      type="date"
                      value={newPolicy.paid_at}
                      onChange={(e) =>
                        setNewPolicy({ ...newPolicy, paid_at: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm border border-border rounded bg-bg text-text"
                    />
                  </Field>
                  <Field label="Número de póliza (opcional)">
                    <input
                      type="text"
                      value={newPolicy.policy_number}
                      onChange={(e) =>
                        setNewPolicy({ ...newPolicy, policy_number: e.target.value })
                      }
                      placeholder="Ej. POL-123456"
                      className="w-full px-3 py-2 text-sm border border-border rounded bg-bg text-text"
                    />
                  </Field>
                  <Field label="Notas (opcional)">
                    <input
                      type="text"
                      value={newPolicy.notes}
                      onChange={(e) => setNewPolicy({ ...newPolicy, notes: e.target.value })}
                      placeholder="Cliente / referencia"
                      className="w-full px-3 py-2 text-sm border border-border rounded bg-bg text-text"
                    />
                  </Field>
                  <button
                    type="button"
                    onClick={handleAddPolicy}
                    disabled={addingPolicy || !newPolicy.paid_at}
                    className="btn btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {addingPolicy ? 'Agregando…' : 'Agregar'}
                  </button>
                </div>

                {policiesError && (
                  <div className="text-xs text-red-700">{policiesError}</div>
                )}

                {/* Listado */}
                <div className="overflow-x-auto">
                  {policiesLoading ? (
                    <div className="text-sm text-muted">Cargando…</div>
                  ) : policies.length === 0 ? (
                    <div className="text-sm text-muted">Sin pólizas registradas.</div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-2 font-medium text-text">Fecha</th>
                          <th className="text-left p-2 font-medium text-text">No. Póliza</th>
                          <th className="text-left p-2 font-medium text-text">Notas</th>
                          <th className="p-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {policies.map((p) => (
                          <tr key={p.id} className="border-b border-border">
                            <td className="p-2 tabular-nums">{formatDateMX(p.paid_at)}</td>
                            <td className="p-2">{p.policy_number || '—'}</td>
                            <td className="p-2">{p.notes || '—'}</td>
                            <td className="p-2 text-right">
                              <button
                                type="button"
                                onClick={() => handleDeletePolicy(p.id)}
                                className="text-xs text-red-600 hover:underline"
                              >
                                Eliminar
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted mb-1">{label}</span>
      {children}
    </label>
  )
}

function advisorStatusLabel(s: string | null): string {
  if (s === 'asesor_12_meses') return 'Asesor 12 meses'
  if (s === 'nueva_generacion') return 'Nueva generación'
  if (s === 'consolidado') return 'Consolidado'
  return 'Sin estatus'
}
