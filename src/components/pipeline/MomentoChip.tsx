import { createPortal } from 'react-dom'
import { useRef, useState, useEffect } from 'react'
import { useFloatingPopover } from '../../shared/hooks/useFloatingPopover'
import { chipBase, chipSizeSm } from '../../shared/utils/chips'
import { isSinRespuesta } from '../../shared/utils/nextAction'
import { pipelineApi } from '../../features/pipeline/pipeline.api'

type MomentoDisplay = 'avanzando' | 'por_definir' | 'sin_respuesta'

function getMomentoDisplay(
  next_action_at: string | null,
  momento_override: string | null
): MomentoDisplay {
  if (momento_override === 'por_definir') return 'por_definir'
  if (next_action_at && isSinRespuesta(next_action_at)) return 'sin_respuesta'
  return 'avanzando'
}

const MOMENTO_STYLES: Record<MomentoDisplay, string> = {
  avanzando: 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-50/90',
  por_definir: 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-50/90',
  sin_respuesta: 'bg-red-50 border-red-200 text-red-900 hover:bg-red-50/90',
}

const MOMENTO_LABELS: Record<MomentoDisplay, string> = {
  avanzando: 'Avanzando',
  por_definir: 'Por definir',
  sin_respuesta: 'Sin respuesta',
}

function MomentoPopoverPortal({
  open,
  anchorRect,
  onClose,
  isPorDefinir,
  onTogglePorDefinir,
}: {
  open: boolean
  anchorRect: DOMRect | null
  onClose: () => void
  isPorDefinir: boolean
  onTogglePorDefinir: () => void
}) {
  const { style } = useFloatingPopover(anchorRect, open)

  if (!open || !anchorRect) return null

  const panel = (
    <div
      role="menu"
      className="rounded-lg border border-neutral-200 bg-white shadow-lg py-1 min-w-[140px]"
      style={style}
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onTogglePorDefinir()
          onClose()
        }}
        className="w-full text-left px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
      >
        {isPorDefinir ? 'Quitar "Por definir"' : 'Marcar "Por definir"'}
      </button>
    </div>
  )

  const content = (
    <>
      <div
        className="fixed inset-0 z-[999]"
        aria-hidden
        onMouseDown={onClose}
      />
      {panel}
    </>
  )
  return createPortal(content, document.body)
}

export function MomentoChip({
  leadId,
  next_action_at,
  momento_override,
  onUpdated,
  onToast,
  className = '',
}: {
  leadId: string
  next_action_at: string | null
  momento_override: string | null
  onUpdated?: () => void | Promise<void>
  onToast?: (msg: string) => void
  className?: string
}) {
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  const display = getMomentoDisplay(next_action_at, momento_override)
  const isPorDefinir = momento_override === 'por_definir'

  const close = () => {
    setOpen(false)
    setAnchorRect(null)
  }

  useEffect(() => {
    if (!open) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    const handleScrollOrResize = () => close()
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    return () => {
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [open])

  const handleToggle = () => {
    const rect = anchorRef.current?.getBoundingClientRect() ?? null
    setAnchorRect(rect)
    setOpen((o) => !o)
  }

  const handleTogglePorDefinir = async () => {
    try {
      await pipelineApi.updateLead(leadId, {
        momento_override: isPorDefinir ? null : 'por_definir',
      })
      onToast?.('Actualizado')
      await onUpdated?.()
    } catch {
      onToast?.('No se pudo actualizar')
    }
  }

  const chipClass = `${chipBase} ${chipSizeSm} ${MOMENTO_STYLES[display]} cursor-pointer transition-colors`

  return (
    <div
      className={`relative inline-block ${className}`}
      data-stop-rowclick="true"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        ref={anchorRef}
        type="button"
        data-stop-rowclick="true"
        onClick={handleToggle}
        aria-expanded={open}
        aria-haspopup="menu"
        className={chipClass}
      >
        {MOMENTO_LABELS[display]}
      </button>
      <MomentoPopoverPortal
        open={open}
        anchorRect={anchorRect}
        onClose={close}
        isPorDefinir={isPorDefinir}
        onTogglePorDefinir={handleTogglePorDefinir}
      />
    </div>
  )
}
