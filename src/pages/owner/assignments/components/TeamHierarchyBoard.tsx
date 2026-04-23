import { useMemo, useState } from 'react'
import type { AssignmentProfile } from '../types'
import { getAssignmentDisplayName } from '../utils'

type Props = {
  advisors: AssignmentProfile[]
  managers: AssignmentProfile[]
  onReassignManager: (
    advisorUserId: string,
    newManagerUserId: string | null
  ) => Promise<{ ok: boolean; message?: string }>
  onToast: (message: string, type: 'success' | 'error') => void
}

const DND_TYPE = 'application/x-vant-advisor'

export function TeamHierarchyBoard({ advisors, managers, onReassignManager, onToast }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const columns = useMemo(() => {
    const unassigned = advisors.filter((a) => !a.manager_user_id)
    const byManager = new Map<string, AssignmentProfile[]>()
    for (const m of managers) {
      byManager.set(m.user_id, advisors.filter((a) => a.manager_user_id === m.user_id))
    }
    return { unassigned, byManager }
  }, [advisors, managers])

  const handleDrop = async (managerId: string | null, e: React.DragEvent) => {
    e.preventDefault()
    const raw = e.dataTransfer.getData(DND_TYPE) || e.dataTransfer.getData('text/plain')
    if (!raw) return
    const r = await onReassignManager(raw, managerId)
    if (!r.ok && r.message) onToast(r.message, 'error')
    else onToast('Asesor reasignado', 'success')
    setDraggingId(null)
  }

  const col = (title: string, list: AssignmentProfile[], managerId: string | null) => (
    <div
      key={managerId ?? 'none'}
      className={`flex flex-col min-w-[200px] max-w-[260px] rounded-lg border-2 border-dashed p-2 transition-colors ${
        draggingId ? 'border-primary/40 bg-primary/5' : 'border-border bg-bg'
      }`}
      data-manager-id={managerId ?? ''}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
      }}
      onDrop={(e) => void handleDrop(managerId, e)}
    >
      <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2 px-1">
        {title}
      </div>
      <div className="space-y-1.5 overflow-y-auto max-h-[480px]">
        {list.map((a) => (
          <div
            key={a.user_id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(DND_TYPE, a.user_id)
              e.dataTransfer.effectAllowed = 'move'
              setDraggingId(a.user_id)
            }}
            onDragEnd={() => setDraggingId(null)}
            className="cursor-grab active:cursor-grabbing rounded-md border border-border bg-surface px-2 py-1.5 text-sm shadow-sm"
          >
            <div className="font-medium text-text truncate">{getAssignmentDisplayName(a)}</div>
            <div className="text-[10px] text-muted truncate">{a.user_id.slice(0, 8)}…</div>
          </div>
        ))}
        {list.length === 0 && (
          <p className="text-xs text-muted px-1 py-4 text-center">Arrastra asesores aquí</p>
        )}
      </div>
    </div>
  )

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Arrastra tarjetas de asesor entre columnas para cambiar su{' '}
        <strong className="text-text">Manager</strong>. Los cambios se guardan al soltar.
      </p>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {col('Sin manager', columns.unassigned, null)}
        {managers.map((m) =>
          col(getAssignmentDisplayName(m), columns.byManager.get(m.user_id) || [], m.user_id)
        )}
      </div>
    </div>
  )
}
