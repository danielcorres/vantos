import { useRef, useState, useEffect } from 'react'

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
  const containerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const handleDoc = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handleDoc)
    return () => document.removeEventListener('pointerdown', handleDoc)
  }, [open])

  const displayValue = normalizeDisplayValue(value)
  const label = getSituationLabel(value)

  if (!displayValue && !onPick) return null

  const handleSelect = async (v: SituationValue) => {
    try {
      await onPick?.(v)
      onToast?.('Actualizado')
      setOpen(false)
    } catch {
      onToast?.('No se pudo actualizar')
    }
  }

  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${className}`}
      data-stop-rowclick="true"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {displayValue ? (
        <button
          type="button"
          data-stop-rowclick="true"
          onClick={() => onPick && setOpen((o) => !o)}
          disabled={!onPick}
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 bg-neutral-100 text-neutral-700 ring-neutral-200 hover:bg-neutral-200 disabled:opacity-100 shrink-0"
        >
          {label}
        </button>
      ) : onPick ? (
        <button
          type="button"
          data-stop-rowclick="true"
          onClick={() => setOpen(true)}
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 shrink-0"
        >
          —
        </button>
      ) : null}

      {open && onPick && (
        <div
          role="menu"
          className="absolute left-0 top-full mt-1 z-50 min-w-[160px] rounded-lg border border-neutral-200 bg-white shadow-lg py-1"
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
      )}
    </div>
  )
}
