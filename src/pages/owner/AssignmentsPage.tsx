import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../shared/auth/AuthProvider'
import { getSystemOwnerId } from '../../lib/systemOwner'
import { isAssignmentsAdmin, isAssignmentsPageRole } from '../../modules/auth/assignmentAccess'

type Profile = {
  user_id: string
  full_name: string | null
  display_name: string | null
  role: 'owner' | 'manager' | 'recruiter' | 'advisor' | 'director' | 'seguimiento' | 'developer'
  manager_user_id: string | null
  recruiter_user_id: string | null
  seguimiento_user_id: string | null
  developer_user_id: string | null
}

const rolesEditable = ['advisor', 'manager', 'recruiter', 'director', 'seguimiento', 'developer'] as const

type EditableRole = (typeof rolesEditable)[number]

function isEditableAssignmentRole(role: Profile['role']): role is EditableRole {
  return (rolesEditable as readonly string[]).includes(role)
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

type RowSaveState = {
  [userId: string]: SaveState
}

function profileMatchesSearch(p: Profile, q: string): boolean {
  if (!q.trim()) return true
  const n = q.trim().toLowerCase()
  const name = (p.full_name || p.display_name || '').toLowerCase()
  const id = p.user_id.toLowerCase()
  return name.includes(n) || id.includes(n)
}

export function AssignmentsPage() {
  const { user, role: currentUserRole, loading: authLoading } = useAuth()
  const currentUserId = user?.id ?? null
  const isAdmin = isAssignmentsAdmin(currentUserRole)
  const canAccess = isAssignmentsPageRole(currentUserRole)

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rowSaveStates, setRowSaveStates] = useState<RowSaveState>({})
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const snapshotsRef = useRef<{ [userId: string]: Profile }>({})

  const [searchQuery, setSearchQuery] = useState('')
  const [filterMissingManager, setFilterMissingManager] = useState(false)
  const [filterMissingRecruiter, setFilterMissingRecruiter] = useState(false)
  const [filterMissingSeguimiento, setFilterMissingSeguimiento] = useState(false)
  const [filterMissingDeveloper, setFilterMissingDeveloper] = useState(false)

  const managers = useMemo(() => profiles.filter((p) => p.role === 'manager'), [profiles])
  const recruiters = useMemo(() => profiles.filter((p) => p.role === 'recruiter'), [profiles])
  const seguimientoProfiles = useMemo(() => profiles.filter((p) => p.role === 'seguimiento'), [profiles])
  const developerProfiles = useMemo(() => profiles.filter((p) => p.role === 'developer'), [profiles])

  const displayedProfiles = useMemo(() => {
    let list = isAdmin ? profiles : profiles.filter((p) => p.role === 'advisor')
    list = list.filter((p) => profileMatchesSearch(p, searchQuery))
    if (filterMissingManager) {
      list = list.filter((p) => p.role === 'advisor' && !p.manager_user_id)
    }
    if (filterMissingRecruiter) {
      list = list.filter((p) => p.role === 'advisor' && !p.recruiter_user_id)
    }
    if (filterMissingSeguimiento) {
      list = list.filter((p) => p.role === 'advisor' && !p.seguimiento_user_id)
    }
    if (filterMissingDeveloper) {
      list = list.filter((p) => p.role === 'advisor' && !p.developer_user_id)
    }
    return list
  }, [
    profiles,
    isAdmin,
    searchQuery,
    filterMissingManager,
    filterMissingRecruiter,
    filterMissingSeguimiento,
    filterMissingDeveloper,
  ])

  useEffect(() => {
    if (!canAccess && !authLoading) {
      return
    }

    const loadData = async () => {
      try {
        const ownerId = await getSystemOwnerId()
        if (mountedRef.current) {
          setOwnerUserId(ownerId)
        }

        const { data, error: fetchError } = await supabase
          .from('profiles')
          .select(
            'user_id, full_name, display_name, role, manager_user_id, recruiter_user_id, seguimiento_user_id, developer_user_id'
          )
          .order('role', { ascending: true })
          .order('full_name', { ascending: true, nullsFirst: false })

        if (fetchError) throw fetchError

        if (mountedRef.current) {
          setProfiles((data as Profile[]) || [])
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
  }, [canAccess, authLoading])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const getDisplayName = useCallback((profile: Profile): string => {
    return profile.full_name || profile.display_name || profile.user_id.slice(0, 8)
  }, [])

  const nameById = useCallback(
    (id: string | null): string => {
      if (!id) return '—'
      const p = profiles.find((x) => x.user_id === id)
      return p ? getDisplayName(p) : id.slice(0, 8)
    },
    [profiles, getDisplayName]
  )

  const saveProfile = async (userId: string, payload: Partial<Profile>): Promise<Profile> => {
    const { data, error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('user_id', userId)
      .select(
        'user_id, full_name, display_name, role, manager_user_id, recruiter_user_id, seguimiento_user_id, developer_user_id'
      )
      .single()

    if (error) throw error
    if (!data) throw new Error('Update did not return a row (possible RLS block).')

    return data as Profile
  }

  const handleRoleChange = async (userId: string, newRole: (typeof rolesEditable)[number] | 'owner') => {
    if (!mountedRef.current || !isAdmin) return

    if (userId === ownerUserId) {
      return
    }

    const profile = profiles.find((p) => p.user_id === userId)
    if (profile) {
      snapshotsRef.current[userId] = { ...profile }
    }

    setRowSaveStates((prev) => ({ ...prev, [userId]: 'saving' }))

    setProfiles((prev) =>
      prev.map((p) => (p.user_id === userId ? { ...p, role: newRole as Profile['role'] } : p))
    )

    try {
      const payload: Partial<Profile> = { role: newRole as Profile['role'] }
      if (newRole !== 'advisor') {
        payload.manager_user_id = null
        payload.recruiter_user_id = null
        payload.seguimiento_user_id = null
        payload.developer_user_id = null
      }

      const updatedProfile = await saveProfile(userId, payload)

      if (mountedRef.current) {
        setProfiles((prev) => prev.map((p) => (p.user_id === userId ? updatedProfile : p)))
        setRowSaveStates((prev) => ({ ...prev, [userId]: 'saved' }))
        setTimeout(() => {
          if (mountedRef.current) {
            setRowSaveStates((prev) => {
              const next = { ...prev }
              delete next[userId]
              return next
            })
          }
        }, 2000)
      }
    } catch (err) {
      console.error('[AssignmentsPage] Error al actualizar role:', err)
      if (snapshotsRef.current[userId]) {
        setProfiles((prev) =>
          prev.map((p) => (p.user_id === userId ? snapshotsRef.current[userId] : p))
        )
        delete snapshotsRef.current[userId]
      }
      if (mountedRef.current) {
        setRowSaveStates((prev) => ({ ...prev, [userId]: 'error' }))
        setTimeout(() => {
          if (mountedRef.current) {
            setRowSaveStates((prev) => {
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
    field:
      | 'manager_user_id'
      | 'recruiter_user_id'
      | 'seguimiento_user_id'
      | 'developer_user_id',
    value: string | null
  ) => {
    if (!mountedRef.current || !isAdmin) return

    const profile = profiles.find((p) => p.user_id === userId)
    if (!profile || profile.role !== 'advisor') return

    if (userId === ownerUserId) {
      return
    }

    if (value === userId) {
      alert('No puedes asignar a un usuario como su propio manager/recruiter/seguimiento/developer')
      return
    }

    if (field === 'manager_user_id' && value) {
      const targetProfile = profiles.find((p) => p.user_id === value)
      if (targetProfile && targetProfile.role !== 'manager') {
        alert('El manager debe tener role "manager"')
        return
      }
    }

    if (field === 'recruiter_user_id' && value) {
      const targetProfile = profiles.find((p) => p.user_id === value)
      if (targetProfile && targetProfile.role !== 'recruiter') {
        alert('El recruiter debe tener role "recruiter"')
        return
      }
    }

    if (field === 'seguimiento_user_id' && value) {
      const targetProfile = profiles.find((p) => p.user_id === value)
      if (targetProfile && targetProfile.role !== 'seguimiento') {
        alert('Seguimiento debe ser un usuario con rol "seguimiento"')
        return
      }
    }

    if (field === 'developer_user_id' && value) {
      const targetProfile = profiles.find((p) => p.user_id === value)
      if (targetProfile && targetProfile.role !== 'developer') {
        alert('Developer debe ser un usuario con rol "developer"')
        return
      }
    }

    snapshotsRef.current[userId] = { ...profile }

    setRowSaveStates((prev) => ({ ...prev, [userId]: 'saving' }))

    setProfiles((prev) =>
      prev.map((p) => (p.user_id === userId ? { ...p, [field]: value } : p))
    )

    try {
      const updatedProfile = await saveProfile(userId, { [field]: value })

      if (mountedRef.current) {
        setProfiles((prev) => prev.map((p) => (p.user_id === userId ? updatedProfile : p)))
        setRowSaveStates((prev) => ({ ...prev, [userId]: 'saved' }))
        setTimeout(() => {
          if (mountedRef.current) {
            setRowSaveStates((prev) => {
              const next = { ...prev }
              delete next[userId]
              return next
            })
          }
        }, 2000)
      }
    } catch (err) {
      console.error('[AssignmentsPage] Error al actualizar asignación:', err)
      if (snapshotsRef.current[userId]) {
        setProfiles((prev) =>
          prev.map((p) => (p.user_id === userId ? snapshotsRef.current[userId] : p))
        )
        delete snapshotsRef.current[userId]
      }
      if (mountedRef.current) {
        setRowSaveStates((prev) => ({ ...prev, [userId]: 'error' }))
        setTimeout(() => {
          if (mountedRef.current) {
            setRowSaveStates((prev) => {
              const next = { ...prev }
              delete next[userId]
              return next
            })
          }
        }, 3000)
      }
    }
  }

  const handleOperativoSlot = async (
    advisorUserId: string,
    field:
      | 'seguimiento_user_id'
      | 'developer_user_id'
      | 'manager_user_id'
      | 'recruiter_user_id',
    assignSelf: boolean
  ) => {
    if (!mountedRef.current || !currentUserId) return
    const profile = profiles.find((p) => p.user_id === advisorUserId)
    if (!profile || profile.role !== 'advisor') return

    snapshotsRef.current[advisorUserId] = { ...profile }
    setRowSaveStates((prev) => ({ ...prev, [advisorUserId]: 'saving' }))

    const nextVal = assignSelf ? currentUserId : null
    setProfiles((prev) =>
      prev.map((p) => (p.user_id === advisorUserId ? { ...p, [field]: nextVal } : p))
    )

    try {
      const updatedProfile = await saveProfile(advisorUserId, { [field]: nextVal })
      if (mountedRef.current) {
        setProfiles((prev) => prev.map((p) => (p.user_id === advisorUserId ? updatedProfile : p)))
        setRowSaveStates((prev) => ({ ...prev, [advisorUserId]: 'saved' }))
        setTimeout(() => {
          if (mountedRef.current) {
            setRowSaveStates((prev) => {
              const next = { ...prev }
              delete next[advisorUserId]
              return next
            })
          }
        }, 2000)
      }
    } catch (err) {
      console.error('[AssignmentsPage] Error al actualizar asignación (operativo):', err)
      if (snapshotsRef.current[advisorUserId]) {
        setProfiles((prev) =>
          prev.map((p) => (p.user_id === advisorUserId ? snapshotsRef.current[advisorUserId] : p))
        )
        delete snapshotsRef.current[advisorUserId]
      }
      if (mountedRef.current) {
        alert(err instanceof Error ? err.message : 'No se pudo guardar')
        setRowSaveStates((prev) => ({ ...prev, [advisorUserId]: 'error' }))
        setTimeout(() => {
          if (mountedRef.current) {
            setRowSaveStates((prev) => {
              const next = { ...prev }
              delete next[advisorUserId]
              return next
            })
          }
        }, 3000)
      }
    }
  }

  if (authLoading) {
    return (
      <div className="text-center p-8">
        <span className="text-muted">Cargando...</span>
      </div>
    )
  }

  if (!canAccess) {
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
        <button type="button" onClick={() => window.location.reload()} className="btn btn-primary">
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
          {isAdmin
            ? 'Administra roles y asignaciones de manager, recruiter, seguimiento y developer para cada usuario.'
            : 'Asignarte a asesores según tu rol (manager, recruiter, seguimiento o developer). Los administradores gestionan el resto.'}
        </p>
      </div>

      <div className="card p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <label className="flex-1 min-w-0">
            <span className="text-xs font-medium text-muted block mb-1">Buscar por nombre o ID</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ej. Juan o uuid…"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-bg text-text"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-3 text-xs">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterMissingManager}
              onChange={(e) => setFilterMissingManager(e.target.checked)}
            />
            Sin manager
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterMissingRecruiter}
              onChange={(e) => setFilterMissingRecruiter(e.target.checked)}
            />
            Sin recruiter
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterMissingSeguimiento}
              onChange={(e) => setFilterMissingSeguimiento(e.target.checked)}
            />
            Sin seguimiento
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterMissingDeveloper}
              onChange={(e) => setFilterMissingDeveloper(e.target.checked)}
            />
            Sin developer
          </label>
        </div>
        <p className="text-xs text-muted">
          Mostrando {displayedProfiles.length} de {isAdmin ? profiles.length : profiles.filter((p) => p.role === 'advisor').length}{' '}
          {isAdmin ? 'usuarios' : 'asesores'}
          {!isAdmin ? ' (solo ves asesores)' : ''}
        </p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-3 font-medium text-text">Usuario</th>
              <th className="text-left p-3 font-medium text-text">Rol</th>
              <th className="text-left p-3 font-medium text-text">Manager</th>
              <th className="text-left p-3 font-medium text-text">Recruiter</th>
              <th className="text-left p-3 font-medium text-text">Seguimiento</th>
              <th className="text-left p-3 font-medium text-text">Developer</th>
              <th className="text-left p-3 font-medium text-text">Estado</th>
            </tr>
          </thead>
          <tbody>
            {displayedProfiles.map((profile) => {
              const saveState = rowSaveStates[profile.user_id] || 'idle'
              const displayName = getDisplayName(profile)
              const isSystemOwner = profile.user_id === ownerUserId
              const isReadOnly = isSystemOwner
              const showRoleDropdown =
                isAdmin && !isReadOnly && isEditableAssignmentRole(profile.role)

              return (
                <tr key={profile.user_id} className="border-b border-border hover:bg-black/5">
                  <td className="p-3">
                    <div className="font-medium text-text">{displayName}</div>
                    <div className="text-xs text-muted">{profile.user_id.slice(0, 8)}...</div>
                    {isSystemOwner && (
                      <div className="mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-700">
                          Owner (sistema)
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    {showRoleDropdown ? (
                      <select
                        value={profile.role}
                        onChange={(e) =>
                          handleRoleChange(
                            profile.user_id,
                            e.target.value as (typeof rolesEditable)[number]
                          )
                        }
                        className="px-2 py-1 text-sm border border-border rounded bg-bg text-text"
                      >
                        <option value="advisor">Advisor</option>
                        <option value="manager">Manager</option>
                        <option value="recruiter">Recruiter</option>
                        <option value="director">Director</option>
                        <option value="seguimiento">Seguimiento</option>
                        <option value="developer">Developer</option>
                      </select>
                    ) : (
                      <span className="text-text font-medium capitalize">{profile.role}</span>
                    )}
                  </td>
                  <td className="p-3">
                    {profile.role === 'advisor' && !isReadOnly && isAdmin ? (
                      <select
                        value={profile.manager_user_id || ''}
                        onChange={(e) =>
                          handleAssignmentChange(
                            profile.user_id,
                            'manager_user_id',
                            e.target.value || null
                          )
                        }
                        className="px-2 py-1 text-sm border border-border rounded bg-bg text-text w-full max-w-[11rem]"
                      >
                        <option value="">Sin manager</option>
                        {managers.map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {getDisplayName(m)}
                          </option>
                        ))}
                      </select>
                    ) : profile.role === 'advisor' && !isReadOnly && currentUserRole === 'manager' ? (
                      <div className="flex flex-col gap-1 items-start">
                        <span className="text-xs text-text">{nameById(profile.manager_user_id)}</span>
                        {profile.manager_user_id === currentUserId ? (
                          <button
                            type="button"
                            className="btn btn-ghost text-xs px-2 py-1"
                            onClick={() => void handleOperativoSlot(profile.user_id, 'manager_user_id', false)}
                          >
                            Quitar mi asignación
                          </button>
                        ) : profile.manager_user_id ? (
                          <span className="text-xs text-muted">Otro usuario asignado</span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary text-xs px-2 py-1"
                            onClick={() => void handleOperativoSlot(profile.user_id, 'manager_user_id', true)}
                          >
                            Asignarme
                          </button>
                        )}
                      </div>
                    ) : profile.role === 'advisor' ? (
                      <span className="text-xs text-text">{nameById(profile.manager_user_id)}</span>
                    ) : (
                      <span className="text-muted text-xs">—</span>
                    )}
                    {profile.role === 'advisor' && !profile.manager_user_id && !isReadOnly && (
                      <div className="mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-50 text-yellow-700">
                          Sin manager
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    {profile.role === 'advisor' && !isReadOnly && isAdmin ? (
                      <select
                        value={profile.recruiter_user_id || ''}
                        onChange={(e) =>
                          handleAssignmentChange(
                            profile.user_id,
                            'recruiter_user_id',
                            e.target.value || null
                          )
                        }
                        className="px-2 py-1 text-sm border border-border rounded bg-bg text-text w-full max-w-[11rem]"
                      >
                        <option value="">Sin recruiter</option>
                        {recruiters.map((r) => (
                          <option key={r.user_id} value={r.user_id}>
                            {getDisplayName(r)}
                          </option>
                        ))}
                      </select>
                    ) : profile.role === 'advisor' && !isReadOnly && currentUserRole === 'recruiter' ? (
                      <div className="flex flex-col gap-1 items-start">
                        <span className="text-xs text-text">{nameById(profile.recruiter_user_id)}</span>
                        {profile.recruiter_user_id === currentUserId ? (
                          <button
                            type="button"
                            className="btn btn-ghost text-xs px-2 py-1"
                            onClick={() => void handleOperativoSlot(profile.user_id, 'recruiter_user_id', false)}
                          >
                            Quitar mi asignación
                          </button>
                        ) : profile.recruiter_user_id ? (
                          <span className="text-xs text-muted">Otro usuario asignado</span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary text-xs px-2 py-1"
                            onClick={() => void handleOperativoSlot(profile.user_id, 'recruiter_user_id', true)}
                          >
                            Asignarme
                          </button>
                        )}
                      </div>
                    ) : profile.role === 'advisor' ? (
                      <span className="text-xs text-text">{nameById(profile.recruiter_user_id)}</span>
                    ) : (
                      <span className="text-muted text-xs">—</span>
                    )}
                    {profile.role === 'advisor' && !profile.recruiter_user_id && !isReadOnly && (
                      <div className="mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-yellow-50 text-yellow-700">
                          Sin recruiter
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    {profile.role === 'advisor' && !isReadOnly && isAdmin ? (
                      <select
                        value={profile.seguimiento_user_id || ''}
                        onChange={(e) =>
                          handleAssignmentChange(
                            profile.user_id,
                            'seguimiento_user_id',
                            e.target.value || null
                          )
                        }
                        className="px-2 py-1 text-sm border border-border rounded bg-bg text-text w-full max-w-[11rem]"
                      >
                        <option value="">Sin seguimiento</option>
                        {seguimientoProfiles.map((s) => (
                          <option key={s.user_id} value={s.user_id}>
                            {getDisplayName(s)}
                          </option>
                        ))}
                      </select>
                    ) : profile.role === 'advisor' && !isReadOnly && currentUserRole === 'seguimiento' ? (
                      <div className="flex flex-col gap-1 items-start">
                        <span className="text-xs text-text">{nameById(profile.seguimiento_user_id)}</span>
                        {profile.seguimiento_user_id === currentUserId ? (
                          <button
                            type="button"
                            className="btn btn-ghost text-xs px-2 py-1"
                            onClick={() => void handleOperativoSlot(profile.user_id, 'seguimiento_user_id', false)}
                          >
                            Quitar mi asignación
                          </button>
                        ) : profile.seguimiento_user_id ? (
                          <span className="text-xs text-muted">Otro usuario asignado</span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary text-xs px-2 py-1"
                            onClick={() => void handleOperativoSlot(profile.user_id, 'seguimiento_user_id', true)}
                          >
                            Asignarme
                          </button>
                        )}
                      </div>
                    ) : profile.role === 'advisor' ? (
                      <span className="text-xs text-text">{nameById(profile.seguimiento_user_id)}</span>
                    ) : (
                      <span className="text-muted text-xs">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {profile.role === 'advisor' && !isReadOnly && isAdmin ? (
                      <select
                        value={profile.developer_user_id || ''}
                        onChange={(e) =>
                          handleAssignmentChange(
                            profile.user_id,
                            'developer_user_id',
                            e.target.value || null
                          )
                        }
                        className="px-2 py-1 text-sm border border-border rounded bg-bg text-text w-full max-w-[11rem]"
                      >
                        <option value="">Sin developer</option>
                        {developerProfiles.map((d) => (
                          <option key={d.user_id} value={d.user_id}>
                            {getDisplayName(d)}
                          </option>
                        ))}
                      </select>
                    ) : profile.role === 'advisor' && !isReadOnly && currentUserRole === 'developer' ? (
                      <div className="flex flex-col gap-1 items-start">
                        <span className="text-xs text-text">{nameById(profile.developer_user_id)}</span>
                        {profile.developer_user_id === currentUserId ? (
                          <button
                            type="button"
                            className="btn btn-ghost text-xs px-2 py-1"
                            onClick={() => void handleOperativoSlot(profile.user_id, 'developer_user_id', false)}
                          >
                            Quitar mi asignación
                          </button>
                        ) : profile.developer_user_id ? (
                          <span className="text-xs text-muted">Otro usuario asignado</span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary text-xs px-2 py-1"
                            onClick={() => void handleOperativoSlot(profile.user_id, 'developer_user_id', true)}
                          >
                            Asignarme
                          </button>
                        )}
                      </div>
                    ) : profile.role === 'advisor' ? (
                      <span className="text-xs text-text">{nameById(profile.developer_user_id)}</span>
                    ) : (
                      <span className="text-muted text-xs">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {saveState === 'saving' && <span className="text-xs text-muted">Guardando...</span>}
                    {saveState === 'saved' && <span className="text-xs text-green-600">✓ Guardado</span>}
                    {saveState === 'error' && <span className="text-xs text-red-600">✗ Error</span>}
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
