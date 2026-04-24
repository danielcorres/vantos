import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../../../lib/supabase'
import type {
  AccountStatus,
  AssignmentProfile,
  AdvisorSeguimientoRow,
  EditableRole,
  RowSaveState,
} from '../types'

const PROFILE_SELECT =
  'user_id, full_name, display_name, role, account_status, manager_user_id, recruiter_user_id, manager_assigned_by, manager_assigned_at, recruiter_assigned_by, recruiter_assigned_at, archived_at, archived_by'

function rowsToProfiles(rows: unknown[] | null | undefined): AssignmentProfile[] {
  return (rows || []).map((row) => ({
    ...(row as AssignmentProfile),
    account_status:
      (row as { account_status?: AccountStatus }).account_status ?? 'active',
    archived_at: (row as { archived_at?: string | null }).archived_at ?? null,
    archived_by: (row as { archived_by?: string | null }).archived_by ?? null,
  })) as AssignmentProfile[]
}

export function useDirectorAssignments(canLoad: boolean) {
  const [profiles, setProfiles] = useState<AssignmentProfile[]>([])
  const [seguimientoLinks, setSeguimientoLinks] = useState<AdvisorSeguimientoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rowSaveStates, setRowSaveStates] = useState<RowSaveState>({})
  const snapshotsRef = useRef<{ [userId: string]: AssignmentProfile }>({})
  const mountedRef = useRef(true)

  const load = useCallback(async () => {
    if (!canLoad) return
    setLoading(true)
    setError(null)
    try {
      const [prRes, segRes] = await Promise.all([
        supabase
          .from('profiles')
          .select(PROFILE_SELECT)
          .order('role', { ascending: true })
          .order('full_name', { ascending: true, nullsFirst: false }),
        supabase.from('advisor_seguimiento').select('advisor_user_id, seguimiento_user_id, assigned_by, assigned_at'),
      ])
      if (prRes.error) throw prRes.error
      if (segRes.error) throw segRes.error
      if (!mountedRef.current) return
      setProfiles(rowsToProfiles(prRes.data || []))
      setSeguimientoLinks((segRes.data || []) as AdvisorSeguimientoRow[])
    } catch (e) {
      console.error('[useDirectorAssignments]', e)
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Error al cargar datos')
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [canLoad])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const saveProfile = useCallback(async (userId: string, payload: Partial<AssignmentProfile>) => {
    const { data, error: upErr } = await supabase
      .from('profiles')
      .update(payload)
      .eq('user_id', userId)
      .select(PROFILE_SELECT)
      .single()
    if (upErr) throw upErr
    if (!data) throw new Error('Update did not return a row (possible RLS block).')
    return data as AssignmentProfile
  }, [])

  const setRowState = useCallback((userId: string, state: RowSaveState[string]) => {
    setRowSaveStates((prev) => ({ ...prev, [userId]: state }))
  }, [])

  const clearRowStateSoon = useCallback((userId: string, ms: number) => {
    setTimeout(() => {
      if (!mountedRef.current) return
      setRowSaveStates((prev) => {
        const next = { ...prev }
        delete next[userId]
        return next
      })
    }, ms)
  }, [])

  const handleRoleChange = useCallback(
    async (userId: string, ownerUserId: string | null, newRole: EditableRole | 'owner') => {
      if (!mountedRef.current) return
      if (userId === ownerUserId) return

      const profile = profiles.find((p) => p.user_id === userId)
      if (profile) snapshotsRef.current[userId] = { ...profile }

      setRowState(userId, 'saving')
      setProfiles((prev) =>
        prev.map((p) => (p.user_id === userId ? { ...p, role: newRole as AssignmentProfile['role'] } : p))
      )

      try {
        const payload: Partial<AssignmentProfile> = { role: newRole as AssignmentProfile['role'] }
        if (newRole !== 'advisor') {
          payload.manager_user_id = null
          payload.recruiter_user_id = null
        }
        const updated = await saveProfile(userId, payload)
        if (!mountedRef.current) return
        setProfiles((prev) => prev.map((p) => (p.user_id === userId ? updated : p)))
        if (newRole !== 'advisor') {
          setSeguimientoLinks((prev) => prev.filter((l) => l.advisor_user_id !== userId))
        }
        setRowState(userId, 'saved')
        clearRowStateSoon(userId, 2000)
        delete snapshotsRef.current[userId]
      } catch (err) {
        console.error('[useDirectorAssignments] role', err)
        if (snapshotsRef.current[userId]) {
          setProfiles((prev) =>
            prev.map((p) => (p.user_id === userId ? snapshotsRef.current[userId] : p))
          )
          delete snapshotsRef.current[userId]
        }
        if (mountedRef.current) {
          setRowState(userId, 'error')
          clearRowStateSoon(userId, 3000)
        }
      }
    },
    [profiles, saveProfile, setRowState, clearRowStateSoon]
  )

  const handleAccountStatusChange = useCallback(
    async (userId: string, ownerUserId: string | null, next: AccountStatus) => {
      if (!mountedRef.current) return
      if (userId === ownerUserId) return

      const profile = profiles.find((p) => p.user_id === userId)
      if (profile) snapshotsRef.current[userId] = { ...profile }

      setRowState(userId, 'saving')
      setProfiles((prev) =>
        prev.map((p) => (p.user_id === userId ? { ...p, account_status: next } : p))
      )

      try {
        const updated = await saveProfile(userId, { account_status: next })
        if (!mountedRef.current) return
        setProfiles((prev) => prev.map((p) => (p.user_id === userId ? updated : p)))
        setRowState(userId, 'saved')
        clearRowStateSoon(userId, 2000)
        delete snapshotsRef.current[userId]
      } catch (err) {
        console.error('[useDirectorAssignments] account_status', err)
        if (snapshotsRef.current[userId]) {
          setProfiles((prev) =>
            prev.map((p) => (p.user_id === userId ? snapshotsRef.current[userId] : p))
          )
          delete snapshotsRef.current[userId]
        }
        if (mountedRef.current) {
          setRowState(userId, 'error')
          clearRowStateSoon(userId, 3000)
        }
      }
    },
    [profiles, saveProfile, setRowState, clearRowStateSoon]
  )

  const handleManagerRecruiterChange = useCallback(
    async (
      userId: string,
      field: 'manager_user_id' | 'recruiter_user_id',
      value: string | null,
      allProfiles: AssignmentProfile[]
    ): Promise<{ ok: true } | { ok: false; message: string }> => {
      if (!mountedRef.current) return { ok: false, message: 'No disponible' }

      const profile = allProfiles.find((p) => p.user_id === userId)
      if (!profile || profile.role !== 'advisor') return { ok: false, message: 'No es asesor' }

      if (field === 'manager_user_id' && value) {
        const target = allProfiles.find((p) => p.user_id === value)
        if (target && target.role !== 'manager') {
          return { ok: false, message: 'El manager debe tener rol Manager' }
        }
      }
      if (field === 'recruiter_user_id' && value) {
        const target = allProfiles.find((p) => p.user_id === value)
        if (target && target.role !== 'recruiter') {
          return { ok: false, message: 'El recluta debe tener rol Recluta' }
        }
      }
      if (value === userId) {
        return { ok: false, message: 'No puedes asignar al asesor como su propio manager/recluta' }
      }

      snapshotsRef.current[userId] = { ...profile }
      setRowState(userId, 'saving')
      setProfiles((prev) => prev.map((p) => (p.user_id === userId ? { ...p, [field]: value } : p)))

      try {
        const updated = await saveProfile(userId, { [field]: value })
        if (!mountedRef.current) return { ok: true }
        setProfiles((prev) => prev.map((p) => (p.user_id === userId ? updated : p)))
        setRowState(userId, 'saved')
        clearRowStateSoon(userId, 2000)
        delete snapshotsRef.current[userId]
        return { ok: true }
      } catch (err) {
        console.error('[useDirectorAssignments] assignment', err)
        if (snapshotsRef.current[userId]) {
          setProfiles((prev) =>
            prev.map((p) => (p.user_id === userId ? snapshotsRef.current[userId] : p))
          )
          delete snapshotsRef.current[userId]
        }
        if (mountedRef.current) {
          setRowState(userId, 'error')
          clearRowStateSoon(userId, 3000)
        }
        return { ok: false, message: err instanceof Error ? err.message : 'Error al guardar' }
      }
    },
    [saveProfile, setRowState, clearRowStateSoon]
  )

  const addSeguimientoLink = useCallback(
    async (advisorUserId: string, seguimientoUserId: string): Promise<{ ok: boolean; message?: string }> => {
      try {
        const { error: insErr } = await supabase.from('advisor_seguimiento').insert({
          advisor_user_id: advisorUserId,
          seguimiento_user_id: seguimientoUserId,
        })
        if (insErr) throw insErr
        const { data, error: qErr } = await supabase
          .from('advisor_seguimiento')
          .select('advisor_user_id, seguimiento_user_id, assigned_by, assigned_at')
          .eq('advisor_user_id', advisorUserId)
          .eq('seguimiento_user_id', seguimientoUserId)
          .maybeSingle()
        if (qErr) throw qErr
        if (data && mountedRef.current) {
          setSeguimientoLinks((prev) => {
            const rest = prev.filter(
              (l) =>
                !(l.advisor_user_id === advisorUserId && l.seguimiento_user_id === seguimientoUserId)
            )
            return [...rest, data as AdvisorSeguimientoRow]
          })
        }
        return { ok: true }
      } catch (e) {
        console.error('[addSeguimientoLink]', e)
        return { ok: false, message: e instanceof Error ? e.message : 'Error' }
      }
    },
    []
  )

  const removeSeguimientoLink = useCallback(
    async (advisorUserId: string, seguimientoUserId: string): Promise<{ ok: boolean; message?: string }> => {
      try {
        const { error: delErr } = await supabase
          .from('advisor_seguimiento')
          .delete()
          .eq('advisor_user_id', advisorUserId)
          .eq('seguimiento_user_id', seguimientoUserId)
        if (delErr) throw delErr
        if (mountedRef.current) {
          setSeguimientoLinks((prev) =>
            prev.filter(
              (l) =>
                !(l.advisor_user_id === advisorUserId && l.seguimiento_user_id === seguimientoUserId)
            )
          )
        }
        return { ok: true }
      } catch (e) {
        console.error('[removeSeguimientoLink]', e)
        return { ok: false, message: e instanceof Error ? e.message : 'Error' }
      }
    },
    []
  )

  const reassignAdvisorManager = useCallback(
    async (advisorUserId: string, newManagerUserId: string | null): Promise<{ ok: boolean; message?: string }> => {
      try {
        const updated = await saveProfile(advisorUserId, { manager_user_id: newManagerUserId })
        if (mountedRef.current) {
          setProfiles((prev) => prev.map((p) => (p.user_id === advisorUserId ? updated : p)))
        }
        return { ok: true }
      } catch (e) {
        console.error('[reassignAdvisorManager]', e)
        return { ok: false, message: e instanceof Error ? e.message : 'Error' }
      }
    },
    [saveProfile]
  )

  const handleArchiveAdvisor = useCallback(
    async (userId: string, ownerUserId: string | null): Promise<{ ok: boolean; message?: string }> => {
      if (!mountedRef.current) return { ok: false, message: 'No disponible' }
      if (userId === ownerUserId) return { ok: false, message: 'Operación no permitida' }
      setRowState(userId, 'saving')
      try {
        const { error: rpcErr } = await supabase.rpc('archive_advisor', { p_user_id: userId })
        if (rpcErr) throw rpcErr
        await load()
        if (!mountedRef.current) return { ok: true }
        setRowState(userId, 'saved')
        clearRowStateSoon(userId, 2000)
        return { ok: true }
      } catch (err) {
        console.error('[handleArchiveAdvisor]', err)
        if (mountedRef.current) {
          setRowState(userId, 'error')
          clearRowStateSoon(userId, 3000)
        }
        return { ok: false, message: err instanceof Error ? err.message : 'Error al archivar' }
      }
    },
    [load, setRowState, clearRowStateSoon]
  )

  const handleRestoreAdvisor = useCallback(
    async (userId: string, ownerUserId: string | null): Promise<{ ok: boolean; message?: string }> => {
      if (!mountedRef.current) return { ok: false, message: 'No disponible' }
      if (userId === ownerUserId) return { ok: false, message: 'Operación no permitida' }
      setRowState(userId, 'saving')
      try {
        const { error: rpcErr } = await supabase.rpc('restore_advisor', { p_user_id: userId })
        if (rpcErr) throw rpcErr
        await load()
        if (!mountedRef.current) return { ok: true }
        setRowState(userId, 'saved')
        clearRowStateSoon(userId, 2000)
        return { ok: true }
      } catch (err) {
        console.error('[handleRestoreAdvisor]', err)
        if (mountedRef.current) {
          setRowState(userId, 'error')
          clearRowStateSoon(userId, 3000)
        }
        return { ok: false, message: err instanceof Error ? err.message : 'Error al restaurar' }
      }
    },
    [load, setRowState, clearRowStateSoon]
  )

  const handleDeleteAdvisorUser = useCallback(
    async (userId: string, ownerUserId: string | null): Promise<{ ok: boolean; message?: string }> => {
      if (!mountedRef.current) return { ok: false, message: 'No disponible' }
      if (userId === ownerUserId) return { ok: false, message: 'Operación no permitida' }
      setRowState(userId, 'saving')
      try {
        const { error: rpcErr } = await supabase.rpc('delete_advisor_user', { p_user_id: userId })
        if (rpcErr) throw rpcErr
        await load()
        if (!mountedRef.current) return { ok: true }
        setRowState(userId, 'saved')
        clearRowStateSoon(userId, 2000)
        return { ok: true }
      } catch (err) {
        console.error('[handleDeleteAdvisorUser]', err)
        if (mountedRef.current) {
          setRowState(userId, 'error')
          clearRowStateSoon(userId, 3000)
        }
        return { ok: false, message: err instanceof Error ? err.message : 'Error al borrar' }
      }
    },
    [load, setRowState, clearRowStateSoon]
  )

  return {
    profiles,
    seguimientoLinks,
    loading,
    error,
    rowSaveStates,
    refetch: load,
    handleRoleChange,
    handleAccountStatusChange,
    handleArchiveAdvisor,
    handleRestoreAdvisor,
    handleDeleteAdvisorUser,
    handleManagerRecruiterChange,
    addSeguimientoLink,
    removeSeguimientoLink,
    reassignAdvisorManager,
    saveProfile,
  }
}

export type LeaderKind = 'manager' | 'recruiter' | 'seguimiento'

export function useLeaderSelfAssign(canLoad: boolean, kind: LeaderKind, myUserId: string | null) {
  const [mine, setMine] = useState<AssignmentProfile[]>([])
  const [available, setAvailable] = useState<AssignmentProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rowStates, setRowStates] = useState<RowSaveState>({})
  const mountedRef = useRef(true)

  const load = useCallback(async () => {
    if (!canLoad || !myUserId) return
    setLoading(true)
    setError(null)
    try {
      if (kind === 'manager') {
        const [mRes, aRes] = await Promise.all([
          supabase
            .from('profiles')
            .select(PROFILE_SELECT)
            .eq('role', 'advisor')
            .eq('manager_user_id', myUserId)
            .order('full_name', { ascending: true, nullsFirst: false }),
          supabase
            .from('profiles')
            .select(PROFILE_SELECT)
            .eq('role', 'advisor')
            .is('manager_user_id', null)
            .order('full_name', { ascending: true, nullsFirst: false }),
        ])
        if (mRes.error) throw mRes.error
        if (aRes.error) throw aRes.error
        if (!mountedRef.current) return
        setMine(rowsToProfiles(mRes.data || []))
        setAvailable(rowsToProfiles(aRes.data || []))
      } else if (kind === 'recruiter') {
        const [mRes, aRes] = await Promise.all([
          supabase
            .from('profiles')
            .select(PROFILE_SELECT)
            .eq('role', 'advisor')
            .eq('recruiter_user_id', myUserId)
            .order('full_name', { ascending: true, nullsFirst: false }),
          supabase
            .from('profiles')
            .select(PROFILE_SELECT)
            .eq('role', 'advisor')
            .is('recruiter_user_id', null)
            .order('full_name', { ascending: true, nullsFirst: false }),
        ])
        if (mRes.error) throw mRes.error
        if (aRes.error) throw aRes.error
        if (!mountedRef.current) return
        setMine(rowsToProfiles(mRes.data || []))
        setAvailable(rowsToProfiles(aRes.data || []))
      } else {
        const { data: links, error: lErr } = await supabase
          .from('advisor_seguimiento')
          .select('advisor_user_id')
          .eq('seguimiento_user_id', myUserId)
        if (lErr) throw lErr
        const mineIds = new Set((links || []).map((r) => r.advisor_user_id))
        const { data: allAdv, error: advErr } = await supabase
          .from('profiles')
          .select(PROFILE_SELECT)
          .eq('role', 'advisor')
          .order('full_name', { ascending: true, nullsFirst: false })
        if (advErr) throw advErr
        const all = rowsToProfiles(allAdv || [])
        if (!mountedRef.current) return
        setMine(all.filter((p) => mineIds.has(p.user_id)))
        setAvailable(all.filter((p) => !mineIds.has(p.user_id)))
      }
    } catch (e) {
      console.error('[useLeaderSelfAssign]', e)
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : 'Error al cargar')
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [canLoad, kind, myUserId])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const claim = useCallback(
    async (advisorUserId: string): Promise<{ ok: boolean; message?: string }> => {
      if (!myUserId) return { ok: false, message: 'Sesión no disponible' }
      setRowStates((s) => ({ ...s, [advisorUserId]: 'saving' }))
      try {
        if (kind === 'seguimiento') {
          const { error: insErr } = await supabase.from('advisor_seguimiento').insert({
            advisor_user_id: advisorUserId,
            seguimiento_user_id: myUserId,
          })
          if (insErr) throw insErr
        } else if (kind === 'manager') {
          const { error: uErr } = await supabase
            .from('profiles')
            .update({ manager_user_id: myUserId })
            .eq('user_id', advisorUserId)
          if (uErr) throw uErr
        } else {
          const { error: uErr } = await supabase
            .from('profiles')
            .update({ recruiter_user_id: myUserId })
            .eq('user_id', advisorUserId)
          if (uErr) throw uErr
        }
        if (mountedRef.current) {
          await load()
          setRowStates((s) => {
            const n = { ...s }
            delete n[advisorUserId]
            return n
          })
        }
        return { ok: true }
      } catch (e) {
        console.error('[claim]', e)
        if (mountedRef.current) {
          setRowStates((s) => ({ ...s, [advisorUserId]: 'error' }))
          setTimeout(() => {
            setRowStates((s) => {
              const n = { ...s }
              delete n[advisorUserId]
              return n
            })
          }, 2500)
        }
        return { ok: false, message: e instanceof Error ? e.message : 'No se pudo asignar' }
      }
    },
    [kind, myUserId, load]
  )

  const release = useCallback(
    async (advisorUserId: string): Promise<{ ok: boolean; message?: string }> => {
      if (!myUserId) return { ok: false, message: 'Sesión no disponible' }
      setRowStates((s) => ({ ...s, [advisorUserId]: 'saving' }))
      try {
        if (kind === 'seguimiento') {
          const { error: delErr } = await supabase
            .from('advisor_seguimiento')
            .delete()
            .eq('advisor_user_id', advisorUserId)
            .eq('seguimiento_user_id', myUserId)
          if (delErr) throw delErr
        } else if (kind === 'manager') {
          const { error: uErr } = await supabase
            .from('profiles')
            .update({ manager_user_id: null })
            .eq('user_id', advisorUserId)
          if (uErr) throw uErr
        } else {
          const { error: uErr } = await supabase
            .from('profiles')
            .update({ recruiter_user_id: null })
            .eq('user_id', advisorUserId)
          if (uErr) throw uErr
        }
        if (mountedRef.current) {
          await load()
          setRowStates((s) => {
            const n = { ...s }
            delete n[advisorUserId]
            return n
          })
        }
        return { ok: true }
      } catch (e) {
        console.error('[release]', e)
        if (mountedRef.current) {
          setRowStates((s) => ({ ...s, [advisorUserId]: 'error' }))
          setTimeout(() => {
            setRowStates((s) => {
              const n = { ...s }
              delete n[advisorUserId]
              return n
            })
          }, 2500)
        }
        return { ok: false, message: e instanceof Error ? e.message : 'No se pudo liberar' }
      }
    },
    [kind, myUserId, load]
  )

  return {
    mine,
    available,
    loading,
    error,
    rowStates,
    refetch: load,
    claim,
    release,
  }
}
