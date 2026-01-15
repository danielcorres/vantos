import { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useUserRole } from '../../shared/hooks/useUserRole'

type Profile = {
  user_id: string
  full_name: string | null
  display_name: string | null
  role: 'owner' | 'manager' | 'recruiter' | 'advisor'
  manager_user_id: string | null
  recruiter_user_id: string | null
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

type RowSaveState = {
  [userId: string]: SaveState
}

export function AssignmentsPage() {
  const { isOwner, loading: roleLoading } = useUserRole()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rowSaveStates, setRowSaveStates] = useState<RowSaveState>({})
  const mountedRef = useRef(true)

  // Filtrar managers y recruiters para los dropdowns
  const managers = useMemo(() => {
    return profiles.filter(p => p.role === 'manager' || p.role === 'owner')
  }, [profiles])

  const recruiters = useMemo(() => {
    return profiles.filter(p => p.role === 'recruiter' || p.role === 'owner')
  }, [profiles])

  // Cargar datos
  useEffect(() => {
    if (!isOwner && !roleLoading) {
      return
    }

    const loadData = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select('user_id, full_name, display_name, role, manager_user_id, recruiter_user_id')
          .order('role', { ascending: true })
          .order('full_name', { ascending: true, nullsFirst: false })

        if (fetchError) throw fetchError

        if (mountedRef.current) {
          setProfiles(data || [])
          setLoading(false)
          setError(null)
        }
      } catch (err) {
        console.error('[AssignmentsPage] Error al cargar perfiles:', err)
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Error al cargar datos')
          setLoading(false)
        }
      }
    }

    loadData()
  }, [isOwner, roleLoading])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const getDisplayName = (profile: Profile): string => {
    return profile.full_name || profile.display_name || profile.user_id.slice(0, 8)
  }

  const handleRoleChange = async (userId: string, newRole: 'owner' | 'manager' | 'recruiter' | 'advisor') => {
    if (!mountedRef.current) return

    setRowSaveStates(prev => ({ ...prev, [userId]: 'saving' }))

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('user_id', userId)

      if (updateError) throw updateError

      // Actualizar estado local
      setProfiles(prev =>
        prev.map(p =>
          p.user_id === userId ? { ...p, role: newRole } : p
        )
      )

      if (mountedRef.current) {
        setRowSaveStates(prev => ({ ...prev, [userId]: 'saved' }))
        setTimeout(() => {
          if (mountedRef.current) {
            setRowSaveStates(prev => {
              const next = { ...prev }
              delete next[userId]
              return next
            })
          }
        }, 2000)
      }
    } catch (err) {
      console.error('[AssignmentsPage] Error al actualizar role:', err)
      if (mountedRef.current) {
        setRowSaveStates(prev => ({ ...prev, [userId]: 'error' }))
        setTimeout(() => {
          if (mountedRef.current) {
            setRowSaveStates(prev => {
              const next = { ...prev }
              delete next[userId]
              return next
            })
          }
        }, 3000)
      }
    }
  }

  const handleAssignmentChange = async (
    userId: string,
    field: 'manager_user_id' | 'recruiter_user_id',
    value: string | null
  ) => {
    if (!mountedRef.current) return

    const profile = profiles.find(p => p.user_id === userId)
    if (!profile || profile.role !== 'advisor') return

    // Validación: no permitir auto-asignación
    if (value === userId) {
      alert('No puedes asignar a un usuario como su propio manager/recruiter')
      return
    }

    // Validación: manager_user_id solo puede ser manager/owner
    if (field === 'manager_user_id' && value) {
      const targetProfile = profiles.find(p => p.user_id === value)
      if (targetProfile && targetProfile.role !== 'manager' && targetProfile.role !== 'owner') {
        alert('El manager debe tener role "manager" o "owner"')
        return
      }
    }

    // Validación: recruiter_user_id solo puede ser recruiter/owner
    if (field === 'recruiter_user_id' && value) {
      const targetProfile = profiles.find(p => p.user_id === value)
      if (targetProfile && targetProfile.role !== 'recruiter' && targetProfile.role !== 'owner') {
        alert('El recruiter debe tener role "recruiter" o "owner"')
        return
      }
    }

    setRowSaveStates(prev => ({ ...prev, [userId]: 'saving' }))

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ [field]: value })
        .eq('user_id', userId)

      if (updateError) throw updateError

      // Actualizar estado local
      setProfiles(prev =>
        prev.map(p =>
          p.user_id === userId ? { ...p, [field]: value } : p
        )
      )

      if (mountedRef.current) {
        setRowSaveStates(prev => ({ ...prev, [userId]: 'saved' }))
        setTimeout(() => {
          if (mountedRef.current) {
            setRowSaveStates(prev => {
              const next = { ...prev }
              delete next[userId]
              return next
            })
          }
        }, 2000)
      }
    } catch (err) {
      console.error('[AssignmentsPage] Error al actualizar asignación:', err)
      if (mountedRef.current) {
        setRowSaveStates(prev => ({ ...prev, [userId]: 'error' }))
        setTimeout(() => {
          if (mountedRef.current) {
            setRowSaveStates(prev => {
              const next = { ...prev }
              delete next[userId]
              return next
            })
          }
        }, 3000)
      }
    }
  }

  if (roleLoading) {
    return (
      <div className="text-center p-8">
        <span className="text-muted">Cargando...</span>
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="text-center p-8">
        <p className="text-red-600">No tienes permisos para ver esta página.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center p-8">
        <span className="text-muted">Cargando asignaciones...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="btn btn-primary"
        >
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text">Asignaciones</h1>
        <p className="text-sm text-muted mt-1">
          Administra roles y asignaciones de manager/recruiter para cada usuario.
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 font-medium text-text">Usuario</th>
              <th className="text-left p-3 font-medium text-text">Rol</th>
              <th className="text-left p-3 font-medium text-text">Manager</th>
              <th className="text-left p-3 font-medium text-text">Recruiter</th>
              <th className="text-left p-3 font-medium text-text">Estado</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map(profile => {
              const saveState = rowSaveStates[profile.user_id] || 'idle'
              const displayName = getDisplayName(profile)

              return (
                <tr key={profile.user_id} className="border-b border-border hover:bg-black/5">
                  <td className="p-3">
                    <div className="font-medium text-text">{displayName}</div>
                    <div className="text-xs text-muted">{profile.user_id.slice(0, 8)}...</div>
                  </td>
                  <td className="p-3">
                    <select
                      value={profile.role}
                      onChange={e =>
                        handleRoleChange(profile.user_id, e.target.value as Profile['role'])
                      }
                      className="px-2 py-1 text-sm border border-border rounded bg-bg text-text"
                    >
                      <option value="advisor">Advisor</option>
                      <option value="manager">Manager</option>
                      <option value="recruiter">Recruiter</option>
                      <option value="owner">Owner</option>
                    </select>
                  </td>
                  <td className="p-3">
                    {profile.role === 'advisor' ? (
                      <select
                        value={profile.manager_user_id || ''}
                        onChange={e =>
                          handleAssignmentChange(
                            profile.user_id,
                            'manager_user_id',
                            e.target.value || null
                          )
                        }
                        className="px-2 py-1 text-sm border border-border rounded bg-bg text-text w-full"
                      >
                        <option value="">Sin manager</option>
                        {managers.map(m => (
                          <option key={m.user_id} value={m.user_id}>
                            {getDisplayName(m)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-muted text-xs">—</span>
                    )}
                    {profile.role === 'advisor' && !profile.manager_user_id && (
                      <div className="mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-50 text-yellow-700">
                          Sin manager
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    {profile.role === 'advisor' ? (
                      <select
                        value={profile.recruiter_user_id || ''}
                        onChange={e =>
                          handleAssignmentChange(
                            profile.user_id,
                            'recruiter_user_id',
                            e.target.value || null
                          )
                        }
                        className="px-2 py-1 text-sm border border-border rounded bg-bg text-text w-full"
                      >
                        <option value="">Sin recruiter</option>
                        {recruiters.map(r => (
                          <option key={r.user_id} value={r.user_id}>
                            {getDisplayName(r)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-muted text-xs">—</span>
                    )}
                    {profile.role === 'advisor' && !profile.recruiter_user_id && (
                      <div className="mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-50 text-yellow-700">
                          Sin recruiter
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    {saveState === 'saving' && (
                      <span className="text-xs text-muted">Guardando...</span>
                    )}
                    {saveState === 'saved' && (
                      <span className="text-xs text-green-600">✓ Guardado</span>
                    )}
                    {saveState === 'error' && (
                      <span className="text-xs text-red-600">✗ Error</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
