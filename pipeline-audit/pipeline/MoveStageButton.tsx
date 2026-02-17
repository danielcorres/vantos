import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Lead } from '../../features/pipeline/pipeline.api'
import { displayStageName } from '../../shared/utils/stageStyles'

export type PipelineStageLite = { id: string; name: string; position: number }

const MENU_HEIGHT_ESTIMATE = 260
const MENU_MIN_WIDTH = 220
const STAGE_MOVE_MENU_Z = 80

/** Menú "Mover etapa" renderizado en portal al body para evitar recorte por overflow. */
function StageMoveMenu({
  open,
  onClose,
  anchorRect,
  stages,
  lead,
  onMoveStage,
  menuRef,
}: {
  open: boolean
  onClose: () => void
  anchorRect: DOMRect | null
  stages: PipelineStageLite[]
  lead: Lead
  onMoveStage: (leadId: string, toStageId: string) => Promise<void>
  menuRef: React.RefObject<HTMLDivElement | null>
}) {
  if (!open || !anchorRect) return null

  const spaceBelow = typeof window !== 'undefined' ? window.innerHeight - anchorRect.bottom : 0
  const openUpward = spaceBelow < MENU_HEIGHT_ESTIMATE
  const left =
    typeof window !== 'undefined'
      ? Math.max(8, Math.min(anchorRect.left, window.innerWidth - MENU_MIN_WIDTH - 8))
      : anchorRect.left

  const style: React.CSSProperties = {
    position: 'fixed',
    left,
    minWidth: MENU_MIN_WIDTH,
    zIndex: STAGE_MOVE_MENU_Z,
    ...(openUpward
      ? { bottom: typeof window !== 'undefined' ? window.innerHeight - anchorRect.top + 4 : anchorRect.top - 4 }
      : { top: anchorRect.bottom + 4 }),
  }

  const sortedStages = [...stages].sort((a, b) => a.position - b.position)
  const content = (
    <div ref={menuRef} role="menu" className="rounded-md border border-neutral-200 bg-white py-1 shadow-lg" style={style}>
      {sortedStages.map((s) => {
        const isCurrent = s.id === lead.stage_id
        return (
          <button
            key={s.id}
            type="button"
            role="menuitem"
            disabled={isCurrent}
            onClick={(e) => {
              e.stopPropagation()
              if (!isCurrent) void onMoveStage(lead.id, s.id)
              onClose()
            }}
            className={`w-full px-3 py-1.5 text-left text-sm ${
              isCurrent ? 'bg-neutral-50 text-neutral-400 cursor-default' : 'hover:bg-neutral-50 text-neutral-800'
            }`}
          >
            {displayStageName(s.name)}{isCurrent ? ' ✓' : ''}
          </button>
        )
      })}
    </div>
  )
  return createPortal(content, document.body)
}

/**
 * Botón "Mover etapa" + menú en portal (desktop/mobile). 
 * Mantenerlo como componente único garantiza que no se vuelva a cortar el menú.
 */
export function MoveStageButton({
  lead,
  stages,
  onMoveStage,
  className = '',
  buttonClassName = '',
}: {
  lead: Lead
  stages: PipelineStageLite[]
  onMoveStage: (leadId: string, toStageId: string) => Promise<void>
  className?: string
  buttonClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Cerrar menú: Escape y click fuera
  useEffect(() => {
    if (!open) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const handleClickOutside = (e: MouseEvent) => {
      const el = menuRef.current
      const trigger = triggerRef.current
      if (el && !el.contains(e.target as Node) && trigger && !trigger.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  return (
    <div className={`relative inline-flex ${className}`}>
      <button
        type="button"
        ref={triggerRef}
        aria-label="Mover etapa"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation()
          const rect = triggerRef.current?.getBoundingClientRect() ?? null
          setAnchorRect(rect)
          setOpen((o) => !o)
        }}
        className={
          buttonClassName ||
          'inline-flex items-center justify-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200 focus-visible:ring-offset-1'
        }
      >
        Mover etapa <span className="text-neutral-400" aria-hidden>▾</span>
      </button>
      <StageMoveMenu
        open={open}
        onClose={() => {
          setOpen(false)
          setAnchorRect(null)
        }}
        anchorRect={anchorRect}
        stages={stages}
        lead={lead}
        onMoveStage={onMoveStage}
        menuRef={menuRef}
      />
    </div>
  )
}
