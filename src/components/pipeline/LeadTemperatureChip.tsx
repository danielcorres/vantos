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

/** Chip compacto para temperatura de interés (no confundir con fuente «Frío»). */
export function LeadTemperatureChip({
  temperature,
  className = '',
}: {
  temperature: string | null | undefined
  className?: string
}) {
  if (!isLeadTemperature(temperature)) return null
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${STYLES[temperature]} ${className}`}
      title="Temperatura de interés"
    >
      {LABELS[temperature]}
    </span>
  )
}
