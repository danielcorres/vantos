import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Toast } from '../../../shared/components/Toast'
import { getSystemOwnerId } from '../../../lib/systemOwner'
import { useAuth } from '../../../shared/auth/AuthProvider'
import { useDirectorAssignments } from './hooks/useAssignments'
import type { AssignmentProfile } from './types'
import { isEditableAssignmentRole } from './types'
import { getAssignmentDisplayName, formatAssignedAt } from './utils'
import { roleLabelEs } from './copy'
import { RoleChip } from './components/RoleChip'
import { LeaderSlotPopover } from './components/LeaderSlotPopover'
import { TeamHierarchyBoard } from './components/TeamHierarchyBoard'
import { ConfirmDialog } from './components/ConfirmDialog'
import { AssignmentEstadoActionsMenu } from './components/AssignmentEstadoActionsMenu'

type Tab = 'people' | 'teams' | 'audit'

type ConfirmKind = 'archive' | 'restore' | 'delete'

export function DirectorAssignmentsView() {
  const { user, role: authRole } = useAuth()
  const currentUserId = user?.id ?? null
  const isOwner = authRole === 'owner'

  const [ownerUserId, setOwnerUserId] = useState<string | null>(null)
  /** Evita pintar la tabla antes de conocer el owner de sistema (protección de filas). */
  const [ownerResolved, setOwnerResolved] = useState(false)
  const [tab, setTab] = useState<Tab>('people')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [popoverAdvisor, setPopoverAdvisor] = useState<AssignmentProfile | null>(null)
  const popBtnRef = useRef<HTMLButtonElement>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [confirm, setConfirm] = useState<{
    kind: ConfirmKind
    userId: string
    name: string
  } | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [estadoMenu, setEstadoMenu] = useState<{ userId: string; anchor: HTMLElement } | null>(null)

  const {
    profiles,
    seguimientoLinks,
    loading,
    error,
    rowSaveStates,
    refetch,
    handleRoleChange,
    handleAccountStatusChange,
    handleArchiveAdvisor,
    handleRestoreAdvisor,
    handleDeleteAdvisorUser,
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

  const peopleProfiles = useMemo(
    () => (showArchived ? profiles : profiles.filter((p) => !p.archived_at)),
    [profiles, showArchived]
  )

  const managers = useMemo(() => profiles.filter((p) => p.role === 'manager'), [profiles])
  const advisors = useMemo(
    () => profiles.filter((p) => p.role === 'advisor' && !p.archived_at),
    [profiles]
  )

  const auditRows = useMemo(() => {
    const withSeg = new Set(seguimientoLinks.map((l) => l.advisor_user_id))
    return profiles
      .filter(
        (p) =>
          p.role === 'advisor' &&
          (!p.archived_at || showArchived) &&
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
  }, [profiles, seguimientoLinks, showArchived])

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

  const canAssignRoles = authRole === 'owner' || authRole === 'director'

  const runConfirm = useCallback(async () => {
    if (!confirm) return
    setConfirmBusy(true)
    try {
      let r: { ok: boolean; message?: string }
      if (confirm.kind === 'archive') {
        r = await handleArchiveAdvisor(confirm.userId, ownerUserId)
      } else if (confirm.kind === 'restore') {
        r = await handleRestoreAdvisor(confirm.userId, ownerUserId)
      } else {
        r = await handleDeleteAdvisorUser(confirm.userId, ownerUserId)
      }
      if (r.ok) {
        const msg =
          confirm.kind === 'archive'
            ? 'Asesor archivado'
            : confirm.kind === 'restore'
              ? 'Asesor restaurado'
              : 'Usuario eliminado del sistema'
        setToast({ type: 'success', message: msg })
        if (popoverAdvisor?.user_id === confirm.userId) setPopoverAdvisor(null)
        setConfirm(null)
      } else {
        setToast({ type: 'error', message: r.message || 'Error' })
      }
    } finally {
      setConfirmBusy(false)
    }
  }, [
    confirm,
    ownerUserId,
    handleArchiveAdvisor,
    handleRestoreAdvisor,
    handleDeleteAdvisorUser,
    popoverAdvisor,
  ])

  useEffect(() => {
    if (!estadoMenu) return
    const mp = profiles.find((p) => p.user_id === estadoMenu.userId)
    if (!mp) setEstadoMenu(null)
  }, [estadoMenu, profiles])

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
      <ConfirmDialog
        open={confirm != null}
        title={
          confirm?.kind === 'archive'
            ? 'Archivar asesor'
            : confirm?.kind === 'restore'
              ? 'Restaurar asesor'
              : 'Borrar usuario permanentemente'
        }
        message={
          confirm?.kind === 'archive'
            ? `¿Archivar a ${confirm.name}? Su cuenta quedará suspendida y no podrá iniciar sesión. Sus datos se conservan.`
            : confirm?.kind === 'restore'
              ? `¿Restaurar a ${confirm.name}? Volverá a estado activo y podrá iniciar sesión.`
              : `¿Borrar PERMANENTEMENTE a ${confirm?.name ?? ''}? Esta acción no se puede deshacer. Sus actividades, pólizas y asignaciones vinculadas serán eliminadas. Sus leads pueden permanecer en el pipeline sin propietario válido.`
        }
        confirmLabel={
          confirm?.kind === 'delete'
            ? 'Borrar definitivamente'
            : confirm?.kind === 'restore'
              ? 'Restaurar'
              : 'Archivar'
        }
        variant={confirm?.kind === 'delete' ? 'danger' : 'default'}
        busy={confirmBusy}
        onCancel={() => !confirmBusy && setConfirm(null)}
        onConfirm={runConfirm}
      />

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
        <div className="card">
          <div className="flex flex-wrap items-center justify-end gap-3 px-3 py-2 border-b border-border dark:border-neutral-800">
            <label className="flex items-center gap-2 text-sm text-muted dark:text-neutral-400 cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-border"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Mostrar archivados
            </label>
          </div>
          <div className="md:hidden divide-y divide-border">
            {peopleProfiles.length === 0 && (
              <div className="p-6 text-center text-sm text-muted">
                {showArchived
                  ? 'No hay usuarios en el directorio.'
                  : 'No hay usuarios activos. Activa «Mostrar archivados» para ver asesores dados de baja.'}
              </div>
            )}
            {peopleProfiles.map((profile) => {
              const saveState = rowSaveStates[profile.user_id] || 'idle'
              const displayName = getAssignmentDisplayName(profile)
              const isSystemOwner = profile.user_id === ownerUserId
              const isReadOnly = isSystemOwner
              const isSelf = currentUserId != null && profile.user_id === currentUserId
              const isArchived = Boolean(profile.archived_at)
              const isAdvisorRow = profile.role === 'advisor'
              const canArchiveThis =
                canAssignRoles && isAdvisorRow && !isReadOnly && !isSelf && !isArchived
              const canRestoreThis =
                canAssignRoles && isAdvisorRow && !isReadOnly && !isSelf && isArchived
              const canDeleteThis = isOwner && isAdvisorRow && !isReadOnly && !isSelf
              const hasEstadoMenuActions =
                isAdvisorRow && !isReadOnly && !isSelf && (canArchiveThis || canRestoreThis || canDeleteThis)

              return (
                <div key={profile.user_id} className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium text-text truncate">{displayName}</div>
                      <div className="text-xs text-muted">{roleLabelEs(profile.role)}</div>
                    </div>
                    {hasEstadoMenuActions && (
                      <button
                        type="button"
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-muted hover:bg-black/[0.04] hover:text-text dark:border-neutral-700 dark:hover:bg-white/10"
                        onClick={(e) => {
                          const el = e.currentTarget
                          setEstadoMenu((prev) =>
                            prev?.userId === profile.user_id ? null : { userId: profile.user_id, anchor: el }
                          )
                        }}
                      >
                        <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">{profile.user_id.slice(0, 8)}…</span>
                    {isArchived && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-200 text-slate-800 dark:bg-neutral-700 dark:text-neutral-100">
                        Archivado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!isReadOnly && !isArchived ? (
                      <div className="inline-flex rounded-md border border-border dark:border-neutral-700 overflow-hidden shadow-sm">
                        <button
                          type="button"
                          className={`px-2.5 py-1.5 text-xs font-medium ${
                            profile.account_status === 'active'
                              ? 'bg-primary text-white'
                              : 'bg-surface text-muted'
                          }`}
                          disabled={profile.account_status === 'active' || saveState === 'saving'}
                          onClick={() =>
                            void handleAccountStatusChange(profile.user_id, ownerUserId, 'active')
                          }
                        >
                          Activo
                        </button>
                        <button
                          type="button"
                          className={`px-2.5 py-1.5 text-xs font-medium border-l border-border dark:border-neutral-700 ${
                            profile.account_status === 'suspended'
                              ? 'bg-amber-600 text-white'
                              : 'bg-surface text-muted'
                          }`}
                          disabled={profile.account_status === 'suspended' || saveState === 'saving'}
                          onClick={() =>
                            void handleAccountStatusChange(profile.user_id, ownerUserId, 'suspended')
                          }
                        >
                          Suspendido
                        </button>
                      </div>
                    ) : (
                      <span className="inline-flex px-2.5 py-1 rounded text-xs font-medium bg-black/5 text-text">
                        {isArchived ? 'Archivado' : profile.account_status === 'suspended' ? 'Suspendido' : 'Activo'}
                      </span>
                    )}
                    {saveState === 'saving' && <span className="text-xs text-muted">Guardando…</span>}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 font-medium text-text">Usuario</th>
                <th className="text-left p-3 font-medium text-text">Rol</th>
                <th className="text-left p-3 font-medium text-text">Líderes</th>
                <th className="text-left p-3 font-medium text-text min-w-[13rem]">Estado</th>
              </tr>
            </thead>
            <tbody>
              {peopleProfiles.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-sm text-muted">
                    {showArchived
                      ? 'No hay usuarios en el directorio.'
                      : 'No hay usuarios activos. Activa «Mostrar archivados» para ver asesores dados de baja.'}
                  </td>
                </tr>
              )}
              {peopleProfiles.map((profile) => {
                const saveState = rowSaveStates[profile.user_id] || 'idle'
                const displayName = getAssignmentDisplayName(profile)
                const isSystemOwner = profile.user_id === ownerUserId
                const isReadOnly = isSystemOwner
                const isSelf = currentUserId != null && profile.user_id === currentUserId
                const isArchived = Boolean(profile.archived_at)
                const isAdvisorRow = profile.role === 'advisor'
                const segN = seguimientoLinks.filter((l) => l.advisor_user_id === profile.user_id)
                  .length
                const canArchiveThis =
                  canAssignRoles && isAdvisorRow && !isReadOnly && !isSelf && !isArchived
                const canRestoreThis =
                  canAssignRoles && isAdvisorRow && !isReadOnly && !isSelf && isArchived
                const canDeleteThis = isOwner && isAdvisorRow && !isReadOnly && !isSelf
                const hasEstadoMenuActions =
                  isAdvisorRow && !isReadOnly && !isSelf && (canArchiveThis || canRestoreThis || canDeleteThis)

                return (
                  <tr
                    key={profile.user_id}
                    className={`border-b border-border hover:bg-black/5 ${
                      isArchived ? 'opacity-80 bg-black/[0.02] dark:bg-white/[0.03]' : ''
                    }`}
                  >
                    <td className="p-3">
                      <div className="font-medium text-text">{displayName}</div>
                      <div className="text-xs text-muted">{profile.user_id.slice(0, 8)}…</div>
                      {isSystemOwner && (
                        <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-700">
                          Owner (sistema)
                        </span>
                      )}
                      {isArchived && (
                        <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-200 text-slate-800 dark:bg-neutral-700 dark:text-neutral-100">
                          Archivado
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {!isReadOnly && isEditableAssignmentRole(profile.role) && !isArchived ? (
                        <RoleChip
                          currentRole={profile.role}
                          onChange={(nr) => void handleRoleChange(profile.user_id, ownerUserId, nr)}
                        />
                      ) : (
                        <span className="font-medium text-text">{roleLabelEs(profile.role)}</span>
                      )}
                    </td>
                    <td className="p-3">
                      {profile.role === 'advisor' && !isReadOnly && !isArchived ? (
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
                    <td className="p-3 min-w-[12rem] align-middle">
                      <div className="flex flex-row flex-wrap items-center gap-1.5">
                        {isReadOnly ? (
                          isArchived ? (
                            <span className="inline-flex rounded-md border border-border dark:border-neutral-700 overflow-hidden shadow-sm pointer-events-none select-none opacity-95">
                              <span className="px-2.5 py-1 text-xs font-medium bg-slate-200 text-slate-800 dark:bg-neutral-700 dark:text-neutral-100">
                                Archivado
                              </span>
                            </span>
                          ) : (
                            <div
                              className="inline-flex rounded-md border border-border dark:border-neutral-700 overflow-hidden shadow-sm pointer-events-none select-none opacity-95"
                              aria-hidden
                            >
                              <span
                                className={`px-2.5 py-1 text-xs font-medium border-0 ${
                                  profile.account_status === 'active'
                                    ? 'bg-primary text-white'
                                    : 'bg-surface text-muted dark:bg-neutral-900'
                                }`}
                              >
                                Activo
                              </span>
                              <span
                                className={`px-2.5 py-1 text-xs font-medium border-0 border-l border-border dark:border-neutral-700 ${
                                  profile.account_status === 'suspended'
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-surface text-muted dark:bg-neutral-900'
                                }`}
                              >
                                Suspendido
                              </span>
                            </div>
                          )
                        ) : isArchived ? (
                          <span className="inline-flex rounded-md border border-border dark:border-neutral-700 overflow-hidden shadow-sm">
                            <span className="px-2.5 py-1 text-xs font-medium bg-slate-200 text-slate-800 dark:bg-neutral-700 dark:text-neutral-100">
                              Archivado
                            </span>
                          </span>
                        ) : (
                          <div
                            className="inline-flex rounded-md border border-border dark:border-neutral-700 overflow-hidden shadow-sm"
                            role="group"
                            aria-label="Estado de cuenta"
                          >
                            <button
                              type="button"
                              className={`px-2.5 py-1 text-xs font-medium border-0 transition-colors ${
                                profile.account_status === 'active'
                                  ? 'bg-primary text-white'
                                  : 'bg-surface text-muted hover:bg-black/[0.04] dark:hover:bg-white/10'
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
                              className={`px-2.5 py-1 text-xs font-medium border-0 border-l border-border dark:border-neutral-700 transition-colors ${
                                profile.account_status === 'suspended'
                                  ? 'bg-amber-600 text-white'
                                  : 'bg-surface text-muted hover:bg-black/[0.04] dark:hover:bg-white/10'
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
                        {hasEstadoMenuActions && (
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-muted hover:bg-black/[0.04] hover:text-text dark:border-neutral-700 dark:hover:bg-white/10 disabled:opacity-50"
                            disabled={saveState === 'saving'}
                            aria-busy={saveState === 'saving' || undefined}
                            aria-label="Más acciones"
                            aria-haspopup="menu"
                            aria-expanded={estadoMenu?.userId === profile.user_id}
                            onClick={(e) => {
                              e.stopPropagation()
                              const el = e.currentTarget
                              setEstadoMenu((prev) =>
                                prev?.userId === profile.user_id ? null : { userId: profile.user_id, anchor: el }
                              )
                            }}
                          >
                            <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
                          </button>
                        )}
                        {saveState === 'saving' && (
                          <span className="text-xs text-muted whitespace-nowrap">Guardando…</span>
                        )}
                        {saveState === 'saved' && (
                          <span className="text-xs text-green-600 whitespace-nowrap">Listo</span>
                        )}
                        {saveState === 'error' && (
                          <span className="text-xs text-red-600 whitespace-nowrap">Error</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
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

      {estadoMenu &&
        (() => {
          const mp = profiles.find((x) => x.user_id === estadoMenu.userId)
          if (!mp) return null
          const isAdv = mp.role === 'advisor'
          const isRO = mp.user_id === ownerUserId
          const isSl = currentUserId != null && mp.user_id === currentUserId
          const isArc = Boolean(mp.archived_at)
          const cArchive = canAssignRoles && isAdv && !isRO && !isSl && !isArc
          const cRestore = canAssignRoles && isAdv && !isRO && !isSl && isArc
          const cDelete = isOwner && isAdv && !isRO && !isSl
          const dn = getAssignmentDisplayName(mp)
          const ss = rowSaveStates[mp.user_id] || 'idle'
          if (!cArchive && !cRestore && !cDelete) return null
          return (
            <AssignmentEstadoActionsMenu
              key={estadoMenu.userId}
              open
              anchorEl={estadoMenu.anchor}
              onClose={() => setEstadoMenu(null)}
              disabled={ss === 'saving'}
              canArchive={cArchive}
              canRestore={cRestore}
              canDelete={cDelete}
              onArchive={() => setConfirm({ kind: 'archive', userId: mp.user_id, name: dn })}
              onRestore={() => setConfirm({ kind: 'restore', userId: mp.user_id, name: dn })}
              onDelete={() => setConfirm({ kind: 'delete', userId: mp.user_id, name: dn })}
            />
          )
        })()}

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