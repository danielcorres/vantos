import { useEffect, useRef, useState, useLayoutEffect } from 'react'

export type AssignmentEstadoActionsMenuProps = {
  open: boolean
  anchorEl: HTMLElement | null
  onClose: () => void
  disabled?: boolean
  canArchive: boolean
  canRestore: boolean
  canDelete: boolean
  onArchive: () => void
  onRestore: () => void
  onDelete: () => void
}

/**
 * Panel flotante para Archivar / Restaurar / Borrar en la columna Estado.
 * El botón disparador vive en la fila; `anchorEl` es el rect objetivo al abrir.
 */
export function AssignmentEstadoActionsMenu(props: AssignmentEstadoActionsMenuProps) {
  const {
    open,
    anchorEl,
    onClose,
    disabled,
    canArchive,
    canRestore,
    canDelete,
    onArchive,
    onRestore,
    onDelete,
  } = props

  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!open || !anchorEl) return
    const place = () => {
      const r = anchorEl.getBoundingClientRect()
      const width = 176
      const left = Math.min(
        Math.max(8, r.left),
        typeof window !== 'undefined' ? window.innerWidth - width - 8 : r.left
      )
      setPos({
        top: r.bottom + 4,
        left,
      })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, anchorEl])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t)) return
      if (anchorEl?.contains(t)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, anchorEl])

  if (!open || !anchorEl) return null
  if (!canArchive && !canRestore && !canDelete) return null

  const itemClass =
    'w-full text-left px-3 py-2 text-sm text-text hover:bg-black/[0.04] dark:hover:bg-white/10 disabled:opacity-50'

  return (
    <div
      ref={panelRef}
      role="menu"
      className="fixed z-[100] min-w-[11rem] rounded-lg border border-border bg-surface py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
      style={{ top: pos.top, left: pos.left }}
    >
      {canArchive && (
        <button
          type="button"
          role="menuitem"
          className={itemClass}
          disabled={disabled}
          onClick={() => {
            onArchive()
            onClose()
          }}
        >
          Archivar
        </button>
      )}
      {canRestore && (
        <button
          type="button"
          role="menuitem"
          className={itemClass}
          disabled={disabled}
          onClick={() => {
            onRestore()
            onClose()
          }}
        >
          Restaurar
        </button>
      )}
      {canDelete && (
        <button
          type="button"
          role="menuitem"
          className={`${itemClass} text-red-600 dark:text-red-400`}
          disabled={disabled}
          onClick={() => {
            onDelete()
            onClose()
          }}
        >
          Borrar
        </button>
      )}
    </div>
  )
}
