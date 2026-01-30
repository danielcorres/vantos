import * as React from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

type StageId = string

/**
 * Selector mobile de etapa (1 columna a la vez):
 * - Flechas para cambiar rápido
 * - <select> nativo (mejor UX en mobile)
 * - Contador opcional
 */
export function MobileStageSwitcher({
  stages,
  value,
  onChange,
  count,
  label = 'Pipeline',
}: {
  stages: { id: StageId; name: string }[]
  value: StageId
  onChange: (stageId: StageId) => void
  count?: number
  label?: string
}) {
  const idx = Math.max(0, stages.findIndex((s) => s.id === value))
  const prev = stages[(idx - 1 + stages.length) % stages.length]
  const next = stages[(idx + 1) % stages.length]

  return (
    <div className="sticky top-0 z-20 border-b border-neutral-200 bg-white/90 backdrop-blur">
      <div className="px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-medium text-neutral-900">{label}</div>
            {typeof count === 'number' ? (
              <div className="text-xs text-neutral-500">{count} leads</div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => prev && onChange(prev.id)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 active:scale-[0.98]"
              aria-label="Etapa anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="relative">
              <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="h-10 w-[210px] appearance-none rounded-xl border border-neutral-200 bg-white px-3 pr-9 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-200"
                aria-label="Seleccionar etapa"
              >
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            </div>

            <button
              type="button"
              onClick={() => next && onChange(next.id)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-white text-neutral-700 active:scale-[0.98]"
              aria-label="Siguiente etapa"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
