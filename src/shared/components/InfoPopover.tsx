import { createPortal } from 'react-dom'
import { useRef, useState, useEffect, useCallback } from 'react'

const PANEL_WIDTH = 280
const OFFSET = 8

export type InfoPopoverProps = {
  title: string
  bullets?: string[]
  tip?: string
  content?: React.ReactNode
  align?: 'left' | 'right'
  side?: 'top' | 'bottom'
  className?: string
}

function getPanelStyle(anchorRect: DOMRect | null): React.CSSProperties {
  if (!anchorRect || typeof window === 'undefined') return {}
  const spaceBelow = window.innerHeight - anchorRect.bottom - OFFSET
  const spaceAbove = anchorRect.top - OFFSET
  const openUpward = spaceBelow < 120 && spaceAbove >= spaceBelow

  const leftClamped = Math.max(
    8,
    Math.min(anchorRect.left, window.innerWidth - PANEL_WIDTH - 8)
  )

  if (openUpward) {
    return {
      position: 'fixed' as const,
      left: leftClamped,
      bottom: window.innerHeight - anchorRect.top + OFFSET,
      maxWidth: PANEL_WIDTH,
      zIndex: 1000,
    }
  }
  return {
    position: 'fixed' as const,
    left: leftClamped,
    top: anchorRect.bottom + OFFSET,
    maxWidth: PANEL_WIDTH,
    zIndex: 1000,
  }
}

export function InfoPopover({
  title,
  bullets = [],
  tip,
  content,
  className = '',
}: InfoPopoverProps) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

  const close = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    setOpen(false)
    setAnchorRect(null)
  }, [])

  const openPopover = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    const rect = buttonRef.current?.getBoundingClientRect() ?? null
    setAnchorRect(rect)
    setOpen(true)
  }, [])

  const scheduleClose = useCallback(() => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current)
    closeTimeoutRef.current = setTimeout(close, 150)
  }, [close])

  const cancelClose = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }, [])

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (open) close()
    else openPopover()
  }

  useEffect(() => {
    if (!open) return
    const handleEscape = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') close()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, close])

  const canHover = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches

  const panelContent = content ?? (
    <div className="space-y-2">
      {bullets.length > 0 && (
        <ul className="list-disc list-inside text-xs text-neutral-700 space-y-1">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
      {tip && (
        <p className="text-[11px] italic text-neutral-500 pt-1 border-t border-neutral-100">
          {tip}
        </p>
      )}
    </div>
  )

  const panel = open && anchorRect && (
    <>
      <div
        className="fixed inset-0 z-[999]"
        aria-hidden
        onMouseDown={close}
      />
      <div
        role="dialog"
        aria-label={title}
        className="rounded-lg border border-neutral-200 bg-white shadow-lg p-3 max-w-[280px]"
        style={getPanelStyle(anchorRect)}
        onMouseEnter={canHover ? cancelClose : undefined}
        onMouseLeave={canHover ? scheduleClose : undefined}
      >
        <p className="text-xs font-semibold text-neutral-900 mb-2">{title}</p>
        {panelContent}
      </div>
    </>
  )

  return (
    <span
      className={`inline-flex ${className}`}
      data-stop-rowclick="true"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        ref={buttonRef}
        type="button"
        data-stop-rowclick="true"
        onClick={toggle}
        onMouseEnter={canHover ? openPopover : undefined}
        onMouseLeave={canHover ? scheduleClose : undefined}
        aria-label={title}
        className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-neutral-200 bg-white text-[10px] text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
      >
        ⓘ
      </button>
      {open && createPortal(panel, document.body)}
    </span>
  )
}
