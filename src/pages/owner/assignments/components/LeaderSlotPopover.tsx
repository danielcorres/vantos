import { useState, useRef, useEffect, useMemo } from 'react'
import type { AssignmentProfile, AdvisorSeguimientoRow } from '../types'
import { getAssignmentDisplayName } from '../utils'
import { roleLabelEs } from '../copy'

type Props = {
  advisor: AssignmentProfile
  allProfiles: AssignmentProfile[]
  seguimientoLinks: AdvisorSeguimientoRow[]
  onClose: () => void
  onManagerChange: (advisorId: string, managerId: string | null) => Promise<{ ok: boolean; message?: string }>
  onRecruiterChange: (advisorId: string, recruiterId: string | null) => Promise<{ ok: boolean; message?: string }>
  onAddSeguimiento: (advisorId: string, segId: string) => Promise<{ ok: boolean; message?: string }>
  onRemoveSeguimiento: (advisorId: string, segId: string) => Promise<{ ok: boolean; message?: string }>
  anchorRef: React.RefObject<HTMLElement | null>
}

export function LeaderSlotPopover({
  advisor,
  allProfiles,
  seguimientoLinks,
  onClose,
  onManagerChange,
  onRecruiterChange,
  onAddSeguimiento,
  onRemoveSeguimiento,
  anchorRef,
}: Props) {
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [managerId, setManagerId] = useState(advisor.manager_user_id || '')
  const [recruiterId, setRecruiterId] = useState(advisor.recruiter_user_id || '')
  const [addSegId, setAddSegId] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setManagerId(advisor.manager_user_id || '')
    setRecruiterId(advisor.recruiter_user_id || '')
    setAddSegId('')
  }, [advisor.user_id, advisor.manager_user_id, advisor.recruiter_user_id])

  const managers = useMemo(() => allProfiles.filter((p) => p.role === 'manager'), [allProfiles])
  const recruiters = useMemo(() => allProfiles.filter((p) => p.role === 'recruiter'), [allProfiles])
  const seguimientoUsers = useMemo(
    () => allProfiles.filter((p) => p.role === 'seguimiento'),
    [allProfiles]
  )

  const linkedSegIds = useMemo(
    () =>
      seguimientoLinks
        .filter((l) => l.advisor_user_id === advisor.user_id)
        .map((l) => l.seguimiento_user_id),
    [seguimientoLinks, advisor.user_id]
  )

  useEffect(() => {
    const el = anchorRef.current
    if (!el) return
    const place = () => {
      const r = el.getBoundingClientRect()
      setPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [anchorRef, advisor.user_id])

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (popRef.current?.contains(t)) return
      if (anchorRef.current?.contains(t)) return
      onClose()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [onClose, anchorRef])

  const applyManager = async () => {
    setBusy(true)
    const r = await onManagerChange(advisor.user_id, managerId || null)
    setBusy(false)
    return r
  }

  const applyRecruiter = async () => {
    setBusy(true)
    const r = await onRecruiterChange(advisor.user_id, recruiterId || null)
    setBusy(false)
    return r
  }

  return (
    <div
      ref={popRef}
      className="fixed z-[100] w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-border bg-surface shadow-xl p-4 space-y-4"
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="flex justify-between items-start gap-2">
        <div>
          <div className="text-sm font-semibold text-text">Líderes del asesor</div>
          <div className="text-xs text-muted">{getAssignmentDisplayName(advisor)}</div>
        </div>
        <button type="button" className="text-muted hover:text-text text-sm" onClick={onClose}>
          ✕
        </button>
      </div>

      <div>
        <label className="text-xs font-medium text-muted block mb-1">{roleLabelEs('manager')}</label>
        <div className="flex gap-2">
          <select
            value={managerId}
            onChange={(e) => setManagerId(e.target.value)}
            className="flex-1 px-2 py-1.5 text-sm border border-border rounded bg-bg text-text"
          >
            <option value="">Sin manager</option>
            {managers.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {getAssignmentDisplayName(m)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            className="btn btn-secondary text-xs shrink-0"
            onClick={() => void applyManager()}
          >
            Guardar
          </button>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted block mb-1">{roleLabelEs('recruiter')}</label>
        <div className="flex gap-2">
          <select
            value={recruiterId}
            onChange={(e) => setRecruiterId(e.target.value)}
            className="flex-1 px-2 py-1.5 text-sm border border-border rounded bg-bg text-text"
          >
            <option value="">Sin recluta</option>
            {recruiters.map((r) => (
              <option key={r.user_id} value={r.user_id}>
                {getAssignmentDisplayName(r)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            className="btn btn-secondary text-xs shrink-0"
            onClick={() => void applyRecruiter()}
          >
            Guardar
          </button>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-muted block mb-1">{roleLabelEs('seguimiento')}</label>
        <ul className="space-y-1 mb-2 max-h-28 overflow-y-auto">
          {linkedSegIds.length === 0 && (
            <li className="text-xs text-muted">Ninguno asignado</li>
          )}
          {linkedSegIds.map((sid) => {
            const p = allProfiles.find((x) => x.user_id === sid)
            return (
              <li
                key={sid}
                className="flex justify-between items-center text-sm bg-black/5 rounded px-2 py-1"
              >
                <span>{p ? getAssignmentDisplayName(p) : sid.slice(0, 8)}</span>
                <button
                  type="button"
                  disabled={busy}
                  className="text-red-600 text-xs"
                  onClick={async () => {
                    setBusy(true)
                    await onRemoveSeguimiento(advisor.user_id, sid)
                    setBusy(false)
                  }}
                >
                  Quitar
                </button>
              </li>
            )
          })}
        </ul>
        <div className="flex gap-2">
          <select
            value={addSegId}
            onChange={(e) => setAddSegId(e.target.value)}
            className="flex-1 px-2 py-1.5 text-sm border border-border rounded bg-bg text-text"
          >
            <option value="">Añadir…</option>
            {seguimientoUsers
              .filter((s) => !linkedSegIds.includes(s.user_id))
              .map((s) => (
                <option key={s.user_id} value={s.user_id}>
                  {getAssignmentDisplayName(s)}
                </option>
              ))}
          </select>
          <button
            type="button"
            disabled={busy || !addSegId}
            className="btn btn-secondary text-xs shrink-0"
            onClick={async () => {
              if (!addSegId) return
              setBusy(true)
              await onAddSeguimiento(advisor.user_id, addSegId)
              setAddSegId('')
              setBusy(false)
            }}
          >
            Añadir
          </button>
        </div>
      </div>
    </div>
  )
}
