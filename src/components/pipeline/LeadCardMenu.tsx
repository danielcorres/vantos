import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { displayStageName } from '../../shared/utils/stageStyles'
import type { Lead } from '../../features/pipeline/pipeline.api'
import type { PipelineStageLite } from './LeadProgressDots'

const MENU_Z = 90

function IconDotsVertical({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 14a1.5 1.5 0 110 3 1.5 1.5 0 010-3z" />
    </svg>
  )
}

/** Menú desplegable en portal para evitar recorte. */
function CardMenuPortal({
  open,
  onClose,
  anchorRect,
  lead,
  stages,
  onMoveStage,
  onEditNextAction,
  menuRef,
}: {
  open: boolean
  onClose: () => void
  anchorRect: DOMRect | null
  lead: Lead
  stages: PipelineStageLite[]
  onMoveStage?: (leadId: string, toStageId: string) => Promise<void>
  onEditNextAction?: () => void
  menuRef: React.RefObject<HTMLDivElement | null>
}) {
  const navigate = useNavigate()

  if (!open || !anchorRect) return null

  const spaceBelow = typeof window !== 'undefined' ? window.innerHeight - anchorRect.bottom : 0
  const openUpward = spaceBelow < 200
  const left = Math.max(8, Math.min(anchorRect.right - 180, window.innerWidth - 180 - 8))
  const style: React.CSSProperties = {
    position: 'fixed',
    left,
    minWidth: 160,
    zIndex: MENU_Z,
    ...(openUpward
      ? { bottom: typeof window !== 'undefined' ? window.innerHeight - anchorRect.top + 4 : 0 }
      : { top: anchorRect.bottom + 4 }),
  }

  const items = [
    { label: 'Abrir lead', onClick: () => { onClose(); navigate(`/leads/${lead.id}`) } },
    ...(onEditNextAction ? [{ label: 'Editar próximo paso', onClick: () => { onClose(); onEditNextAction() } }] : []),
    ...(onMoveStage && stages.length > 0
      ? [
          ...stages
            .filter((s) => s.id !== lead.stage_id)
            .map((s) => ({
              label: `Mover a ${displayStageName(s.name)}`,
              onClick: () => {
                onClose()
                void onMoveStage(lead.id, s.id)
              },
            })),
        ]
      : []),
  ]

  const content = (
    <div
      ref={menuRef}
      role="menu"
      className="rounded-lg border border-neutral-200 bg-white py-1 shadow-lg"
      style={style}
    >
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          role="menuitem"
          onClick={(e) => {
            e.stopPropagation()
            item.onClick()
          }}
          className="w-full px-3 py-1.5 text-left text-sm text-neutral-800 hover:bg-neutral-50"
        >
          {item.label}
        </button>
      ))}
    </div>
  )
  return createPortal(content, document.body)
}

export function LeadCardMenu({
  lead,
  stages,
  onMoveStage,
  onEditNextAction,
  className = '',
}: {
  lead: Lead
  stages: PipelineStageLite[]
  onMoveStage?: (leadId: string, toStageId: string) => Promise<void>
  onEditNextAction?: () => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onEscape = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onClickOutside = (e: MouseEvent) => {
      const el = menuRef.current
      const trigger = triggerRef.current
      if (el && !el.contains(e.target as Node) && trigger && !trigger.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onEscape)
    document.addEventListener('mousedown', onClickOutside)
    return () => {
      document.removeEventListener('keydown', onEscape)
      document.removeEventListener('mousedown', onClickOutside)
    }
  }, [open])

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        ref={triggerRef}
        aria-label="Acciones"
        aria-haspopup="menu"
        aria-expanded={open}
        data-stop-rowclick="true"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setAnchorRect(triggerRef.current?.getBoundingClientRect() ?? null)
          setOpen((o) => !o)
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded text-neutral-400/80 hover:text-neutral-500 hover:bg-neutral-100/80 transition-colors"
      >
        <IconDotsVertical className="w-3.5 h-3.5" />
      </button>
      <CardMenuPortal
        open={open}
        onClose={() => setOpen(false)}
        anchorRect={anchorRect}
        lead={lead}
        stages={stages}
        onMoveStage={onMoveStage}
        onEditNextAction={onEditNextAction}
        menuRef={menuRef}
      />
    </div>
  )
}
