import type { LeadTemperature } from '../../features/pipeline/pipeline.api'

const LABELS: Record<LeadTemperature, string> = {
  frio: 'Frío',
  tibio: 'Tibio',
  caliente: 'Caliente',
}

const STYLES: Record<LeadTemperature, string> = {
  frio: 'bg-slate-100 text-slate-800 ring-slate-200',
  tibio: 'bg-amber-50 text-amber-900 ring-amber-200/80',
  caliente: 'bg-orange-50 text-orange-900 ring-orange-200/80',
}

function isLeadTemperature(v: string | null | undefined): v is LeadTemperature {
  return v === 'frio' || v === 'tibio' || v === 'caliente'
}

const PLACEHOLDER_CLASS =
  'bg-neutral-100 text-neutral-600 ring-neutral-200 dark:bg-neutral-800/80 dark:text-neutral-300 dark:ring-neutral-600'

/** Chip compacto para temperatura de interés (no confundir con fuente «Frío»). */
export function LeadTemperatureChip({
  temperature,
  className = '',
  /** En listas/tablas: muestra «Sin clasificar» cuando aún no hay valor. */
  showPlaceholder = false,
}: {
  temperature: string | null | undefined
  className?: string
  showPlaceholder?: boolean
}) {
  if (isLeadTemperature(temperature)) {
    return (
      <span
        className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${STYLES[temperature]} ${className}`}
        title="Temperatura de interés"
      >
        {LABELS[temperature]}
      </span>
    )
  }
  if (showPlaceholder) {
    return (
      <span
        className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${PLACEHOLDER_CLASS} ${className}`}
        title="Temperatura de interés (sin clasificar)"
      >
        Sin clasificar
      </span>
    )
  }
  return null
}
