import { createPortal } from 'react-dom'
import { useRef, useState, useEffect } from 'react'
import { useFloatingPopover } from '../../shared/hooks/useFloatingPopover'

export type SituationValue = 'waiting_client' | 'docs_pending' | 'paused' | 'unreachable' | null

const SITUATION_OPTIONS: { value: SituationValue; label: string }[] = [
  { value: 'waiting_client', label: 'Esperando cliente' },
  { value: 'docs_pending', label: 'Pendiente docs' },
  { value: 'paused', label: 'En pausa' },
  { value: 'unreachable', label: 'No localizable' },
]

/** Mapeo legacy: budget → paused. Otros legacy → paused. */
function normalizeDisplayValue(v: string | null | undefined): SituationValue | null {
  const x = (v ?? '').trim()
  if (!x) return null
  if (x === 'waiting_client' || x === 'docs_pending' || x === 'paused' || x === 'unreachable') {
    return x
  }
  return 'paused'
}

/** Label para mostrar (incluye legacy budget→En pausa). */
function getSituationLabel(v: string | null | undefined): string {
  const norm = normalizeDisplayValue(v)
  if (!norm) return ''
  const opt = SITUATION_OPTIONS.find((o) => o.value === norm)
  return opt?.label ?? 'En pausa'
}

function SituationPopoverPortal({
  open,
  anchorRect,
  onClose,
  onSelect,
}: {
  open: boolean
  anchorRect: DOMRect | null
  onClose: () => void
  onSelect: (v: SituationValue) => void | Promise<void>
}) {
  const { style } = useFloatingPopover(anchorRect, open)

  if (!open || !anchorRect) return null

  const handleSelect = (v: SituationValue) => {
    void onSelect(v)
    onClose()
  }

  const panel = (
    <div
      role="menu"
      className="rounded-lg border border-neutral-200 bg-white shadow-lg py-1"
      style={style}
    >
      {SITUATION_OPTIONS.map((opt) => (
        <button
          key={opt.value ?? 'null'}
          type="button"
          role="menuitem"
          onClick={() => handleSelect(opt.value)}
          className="w-full text-left px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
        >
          {opt.label}
        </button>
      ))}
      <button
        type="button"
        role="menuitem"
        onClick={() => handleSelect(null)}
        className="w-full text-left px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-50 border-t border-neutral-100 mt-1 pt-1"
      >
        Quitar
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

export function SituationChip({
  value,
  onPick,
  onToast,
  className = '',
}: {
  value: string | null | undefined
  onPick?: (v: SituationValue) => void | Promise<void>
  onToast?: (msg: string) => void
  className?: string
}) {
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)

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

  const displayValue = normalizeDisplayValue(value)
  const label = getSituationLabel(value)

  if (!displayValue && !onPick) return null

  const handleSelect = async (v: SituationValue) => {
    try {
      await onPick?.(v)
      onToast?.('Actualizado')
    } catch {
      onToast?.('No se pudo actualizar')
    }
  }

  const handleToggle = () => {
    if (!onPick) return
    const rect = anchorRef.current?.getBoundingClientRect() ?? null
    setAnchorRect(rect)
    setOpen((o) => !o)
  }

  return (
    <div
      className={`relative inline-block ${className}`}
      data-stop-rowclick="true"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {displayValue ? (
        <button
          ref={anchorRef}
          type="button"
          data-stop-rowclick="true"
          onClick={handleToggle}
          disabled={!onPick}
          aria-expanded={open}
          aria-haspopup="menu"
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 bg-neutral-100 text-neutral-700 ring-neutral-200 hover:bg-neutral-200 disabled:opacity-100 shrink-0"
        >
          {label}
        </button>
      ) : onPick ? (
        <button
          ref={anchorRef}
          type="button"
          data-stop-rowclick="true"
          onClick={() => {
            const rect = anchorRef.current?.getBoundingClientRect() ?? null
            setAnchorRect(rect)
            setOpen(true)
          }}
          aria-expanded={open}
          aria-haspopup="menu"
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 shrink-0"
        >
          —
        </button>
      ) : null}

      {onPick && (
        <SituationPopoverPortal
          open={open}
          anchorRect={anchorRect}
          onClose={close}
          onSelect={handleSelect}
        />
      )}
    </div>
  )
}
