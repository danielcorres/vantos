import { useState, useEffect, useRef, useMemo } from 'react'
import { Toast } from '../../../shared/components/Toast'
import { getSystemOwnerId } from '../../../lib/systemOwner'
import { useDirectorAssignments } from './hooks/useAssignments'
import type { AssignmentProfile } from './types'
import { isEditableAssignmentRole } from './types'
import { getAssignmentDisplayName, formatAssignedAt } from './utils'
import { roleLabelEs } from './copy'
import { RoleChip } from './components/RoleChip'
import { LeaderSlotPopover } from './components/LeaderSlotPopover'
import { TeamHierarchyBoard } from './components/TeamHierarchyBoard'

type Tab = 'people' | 'teams' | 'audit'

export function DirectorAssignmentsView() {
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null)
  /** Evita pintar la tabla antes de conocer el owner de sistema (protección de filas). */
  const [ownerResolved, setOwnerResolved] = useState(false)
  const [tab, setTab] = useState<Tab>('people')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [popoverAdvisor, setPopoverAdvisor] = useState<AssignmentProfile | null>(null)
  const popBtnRef = useRef<HTMLButtonElement>(null)

  const {
    profiles,
    seguimientoLinks,
    loading,
    error,
    rowSaveStates,
    refetch,
    handleRoleChange,
    handleAccountStatusChange,
    handleManagerRecruiterChange,
    addSeguimientoLink,
    removeSeguimientoLink,
    reassignAdvisorManager,
  } = useDirectorAssignments(true)

  useEffect(() => {
    let cancelled = false
    void getSystemOwnerId()
      .then((id) => {
        if (!cancelled) {
          setOwnerUserId(id)
          setOwnerResolved(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOwnerUserId(null)
          setOwnerResolved(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const managers = useMemo(() => profiles.filter((p) => p.role === 'manager'), [profiles])
  const advisors = useMemo(() => profiles.filter((p) => p.role === 'advisor'), [profiles])

  const auditRows = useMemo(() => {
    const withSeg = new Set(seguimientoLinks.map((l) => l.advisor_user_id))
    return profiles
      .filter(
        (p) =>
          p.role === 'advisor' &&
          (p.manager_assigned_at || p.recruiter_assigned_at || withSeg.has(p.user_id))
      )
      .map((p) => {
        const segCount = seguimientoLinks.filter((l) => l.advisor_user_id === p.user_id).length
        const lastSeg = seguimientoLinks
          .filter((l) => l.advisor_user_id === p.user_id)
          .sort((a, b) => (b.assigned_at || '').localeCompare(a.assigned_at || ''))[0]
        return { p, segCount, lastSeg }
      })
      .sort((a, b) => {
        const ta = Math.max(
          Date.parse(a.p.manager_assigned_at || '') || 0,
          Date.parse(a.p.recruiter_assigned_at || '') || 0,
          Date.parse(a.lastSeg?.assigned_at || '') || 0
        )
        const tb = Math.max(
          Date.parse(b.p.manager_assigned_at || '') || 0,
          Date.parse(b.p.recruiter_assigned_at || '') || 0,
          Date.parse(b.lastSeg?.assigned_at || '') || 0
        )
        return tb - ta
      })
  }, [profiles, seguimientoLinks])

  const wrapManager = async (advisorId: string, managerId: string | null) => {
    const r = await handleManagerRecruiterChange(
      advisorId,
      'manager_user_id',
      managerId,
      profiles
    )
    if (!r.ok) setToast({ type: 'error', message: r.message })
    else {
      setToast({ type: 'success', message: 'Manager actualizado' })
      setPopoverAdvisor(null)
    }
    return r
  }

  const wrapRecruiter = async (advisorId: string, recruiterId: string | null) => {
    const r = await handleManagerRecruiterChange(
      advisorId,
      'recruiter_user_id',
      recruiterId,
      profiles
    )
    if (!r.ok) setToast({ type: 'error', message: r.message })
    else {
      setToast({ type: 'success', message: 'Recluta actualizado' })
      setPopoverAdvisor(null)
    }
    return r
  }

  const wrapAddSeg = async (advisorId: string, segId: string) => {
    const r = await addSeguimientoLink(advisorId, segId)
    if (!r.ok) setToast({ type: 'error', message: r.message || 'Error' })
    else setToast({ type: 'success', message: 'Seguimiento añadido' })
    return r
  }

  const wrapRemoveSeg = async (advisorId: string, segId: string) => {
    const r = await removeSeguimientoLink(advisorId, segId)
    if (!r.ok) setToast({ type: 'error', message: r.message || 'Error' })
    else setToast({ type: 'success', message: 'Seguimiento quitado' })
    return r
  }

  if (loading || !ownerResolved) {
    return (
      <div className="text-center p-8">
        <span className="text-muted">Cargando asignaciones…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center p-8 space-y-4">
        <p className="text-red-600">{error}</p>
        <button type="button" className="btn btn-primary" onClick={() => void refetch()}>
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div>
        <h1 className="text-2xl font-semibold text-text">Asignaciones</h1>
        <p className="text-sm text-muted mt-1">
          Administra roles, managers, reclutas y seguimiento (varios por asesor).
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {(
          [
            ['people', 'Personas'],
            ['teams', 'Equipos'],
            ['audit', 'Auditoría'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-primary text-white'
                : 'text-muted hover:bg-black/5'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'people' && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 font-medium text-text">Usuario</th>
                <th className="text-left p-3 font-medium text-text">Rol</th>
                <th className="text-left p-3 font-medium text-text">Líderes</th>
                <th className="text-left p-3 font-medium text-text">Estado</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => {
                const saveState = rowSaveStates[profile.user_id] || 'idle'
                const displayName = getAssignmentDisplayName(profile)
                const isSystemOwner = profile.user_id === ownerUserId
                const isReadOnly = isSystemOwner
                const segN = seguimientoLinks.filter((l) => l.advisor_user_id === profile.user_id)
                  .length

                return (
                  <tr key={profile.user_id} className="border-b border-border hover:bg-black/5">
                    <td className="p-3">
                      <div className="font-medium text-text">{displayName}</div>
                      <div className="text-xs text-muted">{profile.user_id.slice(0, 8)}…</div>
                      {isSystemOwner && (
                        <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-700">
                          Owner (sistema)
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {!isReadOnly && isEditableAssignmentRole(profile.role) ? (
                        <RoleChip
                          currentRole={profile.role}
                          onChange={(nr) => void handleRoleChange(profile.user_id, ownerUserId, nr)}
                        />
                      ) : (
                        <span className="font-medium text-text">{roleLabelEs(profile.role)}</span>
                      )}
                    </td>
                    <td className="p-3">
                      {profile.role === 'advisor' && !isReadOnly ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted">
                            M:{' '}
                            {profile.manager_user_id
                              ? (() => {
                                  const m = profiles.find((x) => x.user_id === profile.manager_user_id)
                                  return m
                                    ? getAssignmentDisplayName(m)
                                    : profile.manager_user_id.slice(0, 8) + '…'
                                })()
                              : '—'}
                          </span>
                          <span className="text-xs text-muted">
                            R:{' '}
                            {profile.recruiter_user_id
                              ? (() => {
                                  const rc = profiles.find((x) => x.user_id === profile.recruiter_user_id)
                                  return rc
                                    ? getAssignmentDisplayName(rc)
                                    : profile.recruiter_user_id.slice(0, 8) + '…'
                                })()
                              : '—'}
                          </span>
                          <span className="text-xs text-muted">S: {segN}</span>
                          <button
                            type="button"
                            className="btn btn-secondary text-xs"
                            onClick={(e) => {
                              popBtnRef.current = e.currentTarget
                              setPopoverAdvisor(profile)
                            }}
                          >
                            Editar
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted text-xs">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-col gap-1.5">
                        {isReadOnly ? (
                          <span className="inline-flex w-fit items-center px-2 py-1 rounded-md bg-black/5 text-sm font-medium text-text">
                            {profile.account_status === 'suspended' ? 'Suspendido' : 'Activo'}
                          </span>
                        ) : (
                          <div className="inline-flex rounded-md border border-border p-0.5 gap-0.5 bg-bg">
                            <button
                              type="button"
                              className={`px-2.5 py-1 text-xs font-medium rounded ${
                                profile.account_status === 'active'
                                  ? 'bg-primary text-white'
                                  : 'text-text hover:bg-black/5'
                              }`}
                              disabled={
                                profile.account_status === 'active' || saveState === 'saving'
                              }
                              onClick={() =>
                                void handleAccountStatusChange(
                                  profile.user_id,
                                  ownerUserId,
                                  'active'
                                )
                              }
                            >
                              Activo
                            </button>
                            <button
                              type="button"
                              className={`px-2.5 py-1 text-xs font-medium rounded ${
                                profile.account_status === 'suspended'
                                  ? 'bg-primary text-white'
                                  : 'text-text hover:bg-black/5'
                              }`}
                              disabled={
                                profile.account_status === 'suspended' ||
                                saveState === 'saving'
                              }
                              onClick={() =>
                                void handleAccountStatusChange(
                                  profile.user_id,
                                  ownerUserId,
                                  'suspended'
                                )
                              }
                            >
                              Suspendido
                            </button>
                          </div>
                        )}
                        {saveState === 'saving' && (
                          <span className="text-xs text-muted">Guardando…</span>
                        )}
                        {saveState === 'saved' && (
                          <span className="text-xs text-green-600">Guardado</span>
                        )}
                        {saveState === 'error' && (
                          <span className="text-xs text-red-600">Error</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'teams' && (
        <div className="card p-4">
          <TeamHierarchyBoard
            advisors={advisors}
            managers={managers}
            onReassignManager={reassignAdvisorManager}
            onToast={(msg, type) => setToast({ message: msg, type })}
          />
        </div>
      )}

      {tab === 'audit' && (
        <div className="card overflow-x-auto">
          <p className="text-sm text-muted p-3 border-b border-border">
            Vista de auditoría: fechas de última asignación en Manager/Recluta y enlaces de
            Seguimiento.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3">Asesor</th>
                <th className="text-left p-3">Manager (cuándo / quién)</th>
                <th className="text-left p-3">Recluta (cuándo / quién)</th>
                <th className="text-left p-3">Seguimiento</th>
              </tr>
            </thead>
            <tbody>
              {auditRows.map(({ p, segCount, lastSeg }) => (
                <tr key={p.user_id} className="border-b border-border">
                  <td className="p-3 font-medium">{getAssignmentDisplayName(p)}</td>
                  <td className="p-3 text-xs text-muted">
                    {formatAssignedAt(p.manager_assigned_at)}
                    <br />
                    {p.manager_assigned_by
                      ? profiles.find((x) => x.user_id === p.manager_assigned_by)?.full_name ||
                        p.manager_assigned_by.slice(0, 8)
                      : '—'}
                  </td>
                  <td className="p-3 text-xs text-muted">
                    {formatAssignedAt(p.recruiter_assigned_at)}
                    <br />
                    {p.recruiter_assigned_by
                      ? profiles.find((x) => x.user_id === p.recruiter_assigned_by)?.full_name ||
                        p.recruiter_assigned_by.slice(0, 8)
                      : '—'}
                  </td>
                  <td className="p-3 text-xs text-muted">
                    {segCount} enlace(s)
                    {lastSeg && (
                      <>
                        <br />
                        Último: {formatAssignedAt(lastSeg.assigned_at)}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {auditRows.length === 0 && (
            <p className="p-6 text-center text-muted text-sm">Sin datos de auditoría aún.</p>
          )}
        </div>
      )}

      {popoverAdvisor && (
        <LeaderSlotPopover
          advisor={popoverAdvisor}
          allProfiles={profiles}
          seguimientoLinks={seguimientoLinks}
          anchorRef={popBtnRef}
          onClose={() => setPopoverAdvisor(null)}
          onManagerChange={wrapManager}
          onRecruiterChange={wrapRecruiter}
          onAddSeguimiento={wrapAddSeg}
          onRemoveSeguimiento={wrapRemoveSeg}
        />
      )}
    </div>
  )
}