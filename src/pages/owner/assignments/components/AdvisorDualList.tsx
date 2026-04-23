import { useMemo, useState } from 'react'
import type { AssignmentProfile } from '../types'
import type { RowSaveState } from '../types'
import { getAssignmentDisplayName } from '../utils'
import { roleLabelEs } from '../copy'

type Props = {
  titleMine: string
  titleAvailable: string
  slotKind: 'manager' | 'recruiter' | 'seguimiento'
  mine: AssignmentProfile[]
  available: AssignmentProfile[]
  rowStates: RowSaveState
  onClaim: (advisorId: string) => Promise<{ ok: boolean; message?: string }>
  onRelease: (advisorId: string) => Promise<{ ok: boolean; message?: string }>
  onToast: (message: string, type: 'success' | 'error') => void
}

export function AdvisorDualList({
  titleMine,
  titleAvailable,
  slotKind,
  mine,
  available,
  rowStates,
  onClaim,
  onRelease,
  onToast,
}: Props) {
  const [q, setQ] = useState('')
  const [selMine, setSelMine] = useState<Set<string>>(new Set())
  const [selAvail, setSelAvail] = useState<Set<string>>(new Set())

  const mineF = useMemo(() => {
    const qnorm = q.trim().toLowerCase()
    if (!qnorm) return mine
    return mine.filter((p) => {
      const n = getAssignmentDisplayName(p).toLowerCase()
      return n.includes(qnorm) || p.user_id.toLowerCase().includes(qnorm)
    })
  }, [mine, q])

  const availF = useMemo(() => {
    const qnorm = q.trim().toLowerCase()
    if (!qnorm) return available
    return available.filter((p) => {
      const n = getAssignmentDisplayName(p).toLowerCase()
      return n.includes(qnorm) || p.user_id.toLowerCase().includes(qnorm)
    })
  }, [available, q])

  const toggle = (set: Set<string>, id: string, on: boolean) => {
    const n = new Set(set)
    if (on) n.add(id)
    else n.delete(id)
    return n
  }

  const bulkRelease = async () => {
    const ids = [...selMine]
    if (ids.length === 0) return
    let ok = 0
    for (const id of ids) {
      const r = await onRelease(id)
      if (r.ok) ok++
      else if (r.message) onToast(r.message, 'error')
    }
    setSelMine(new Set())
    onToast(`${ok} asesor(es) liberados`, 'success')
  }

  const bulkClaim = async () => {
    const ids = [...selAvail]
    if (ids.length === 0) return
    let ok = 0
    for (const id of ids) {
      const r = await onClaim(id)
      if (r.ok) ok++
      else if (r.message) onToast(r.message, 'error')
    }
    setSelAvail(new Set())
    onToast(`${ok} asesor(es) asignados a ti`, 'success')
  }

  const otherLabel =
    slotKind === 'manager'
      ? 'Recluta'
      : slotKind === 'recruiter'
        ? 'Manager'
        : 'Manager / recluta'

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <input
          type="search"
          placeholder="Buscar por nombre o ID…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-bg text-text max-w-md"
        />
        <div className="text-sm text-muted">
          {roleLabelEs(slotKind)}: <strong>{mine.length}</strong> tuyos ·{' '}
          <strong>{available.length}</strong> disponibles
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="card p-3 flex flex-col min-h-[280px]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-text">{titleMine}</h3>
            <button
              type="button"
              className="btn btn-secondary text-xs"
              disabled={selMine.size === 0}
              onClick={() => void bulkRelease()}
            >
              Liberar selección ({selMine.size})
            </button>
          </div>
          <ul className="space-y-1 overflow-y-auto flex-1 max-h-[420px] pr-1">
            {mineF.map((p) => {
              const st = rowStates[p.user_id]
              return (
                <li
                  key={p.user_id}
                  className="flex items-center gap-2 rounded border border-border px-2 py-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selMine.has(p.user_id)}
                    onChange={(e) => setSelMine(toggle(selMine, p.user_id, e.target.checked))}
                    aria-label={`Seleccionar ${getAssignmentDisplayName(p)}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-text truncate">{getAssignmentDisplayName(p)}</div>
                    <div className="text-xs text-muted truncate">
                      {slotKind !== 'manager' && p.manager_user_id && <span>Con manager · </span>}
                      {slotKind !== 'recruiter' && p.recruiter_user_id && <span>Con recluta · </span>}
                      <span className="text-muted">{otherLabel}</span>
                    </div>
                  </div>
                  {st === 'saving' && <span className="text-xs text-muted">…</span>}
                  {st === 'error' && <span className="text-xs text-red-600">!</span>}
                  <button
                    type="button"
                    className="btn btn-secondary text-xs shrink-0"
                    disabled={st === 'saving'}
                    onClick={async () => {
                      const r = await onRelease(p.user_id)
                      if (!r.ok && r.message) onToast(r.message, 'error')
                      else onToast('Liberado', 'success')
                    }}
                  >
                    Liberar
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="card p-3 flex flex-col min-h-[280px]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-text">{titleAvailable}</h3>
            <button
              type="button"
              className="btn btn-primary text-xs"
              disabled={selAvail.size === 0}
              onClick={() => void bulkClaim()}
            >
              Asignar a mí ({selAvail.size})
            </button>
          </div>
          <ul className="space-y-1 overflow-y-auto flex-1 max-h-[420px] pr-1">
            {availF.map((p) => {
              const st = rowStates[p.user_id]
              return (
                <li
                  key={p.user_id}
                  className="flex items-center gap-2 rounded border border-dashed border-border px-2 py-1.5 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selAvail.has(p.user_id)}
                    onChange={(e) => setSelAvail(toggle(selAvail, p.user_id, e.target.checked))}
                    aria-label={`Seleccionar ${getAssignmentDisplayName(p)}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-text truncate">{getAssignmentDisplayName(p)}</div>
                    <div className="text-xs text-muted">Sin {roleLabelEs(slotKind)}</div>
                  </div>
                  {st === 'saving' && <span className="text-xs text-muted">…</span>}
                  {st === 'error' && <span className="text-xs text-red-600">!</span>}
                  <button
                    type="button"
                    className="btn btn-primary text-xs shrink-0"
                    disabled={st === 'saving'}
                    onClick={async () => {
                      const r = await onClaim(p.user_id)
                      if (!r.ok && r.message) onToast(r.message, 'error')
                      else onToast('Asignado a tu equipo', 'success')
                    }}
                  >
                    Asignar a mí
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}
