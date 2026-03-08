import { useMemo } from 'react'
import type { Lead } from '../pipeline.api'
import type { PipelineStage } from '../pipeline.api'
import {
  getStageCounts,
  computeStockStatus,
  pickPrimarySuggestion,
  isAllGreen,
  type FunnelMetricStatus,
} from '../domain/pipeline.funnel'
const STATUS_STYLES: Record<FunnelMetricStatus['status'], string> = {
  green: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  amber: 'bg-amber-50 border-amber-200 text-amber-800',
  red: 'bg-red-50/80 border-red-200/80 text-red-800',
}

type PipelineFunnelHealthProps = {
  /** Lista completa de leads activos del asesor. No debe ser filtrada por próxima acción, búsqueda ni vista. */
  leads: Lead[]
  stages: PipelineStage[]
}

export function PipelineFunnelHealth({
  leads,
  stages,
}: PipelineFunnelHealthProps) {
  const { statuses, suggestion, allGreen } = useMemo(() => {
    const counts = getStageCounts(leads, stages)
    const statuses = computeStockStatus(counts)
    const suggestion = pickPrimarySuggestion(statuses)
    const allGreen = isAllGreen(statuses)
    return { statuses, suggestion, allGreen }
  }, [leads, stages])

  /** Etiquetas cortas para chips en una sola fila */
  const SHORT_LABELS: Record<string, string> = {
    contactos_nuevos: 'Pendiente',
    citas_agendadas: 'Cita',
    solicitudes_ingresadas: 'Trámite',
    casos_abiertos: '1ª',
    citas_cierre: 'Cierre',
    casos_ganados: 'Póliza',
  }

  if (stages.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 px-3 py-2.5">
        <p className="text-xs font-medium text-neutral-600">Mi Embudo</p>
        <p className="text-sm text-neutral-400 mt-0.5">—</p>
      </div>
    )
  }

  const Chip = ({ m }: { m: FunnelMetricStatus }) => {
    const shortLabel = SHORT_LABELS[m.slug] ?? m.label
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${STATUS_STYLES[m.status]}`}
        title={`${m.label}: ${m.value} / ${m.target} (${m.status})`}
      >
        <span className="text-neutral-600 shrink-0">{shortLabel}</span>
        <span className="tabular-nums">{m.value}</span>
        <span className="text-neutral-500 font-normal">/</span>
        <span className="tabular-nums">{m.target}</span>
        <span className="sr-only">({m.status})</span>
      </span>
    )
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50/40 px-3 py-2.5">
      <p className="text-xs font-medium text-neutral-600 mb-2">Mi Embudo</p>
      <div className="inline-flex flex-wrap items-center gap-2">
        {statuses.map((m) => (
          <Chip key={m.slug} m={m} />
        ))}
      </div>
      {suggestion && (
        <div
          className="mt-2 rounded-md border border-amber-200/80 bg-amber-50/60 px-2.5 py-1.5 text-sm text-amber-900"
          role="status"
        >
          <span className="font-medium">⚡ Acción recomendada:</span>{' '}
          <span>{suggestion.message}</span>
        </div>
      )}
      {allGreen && !suggestion && (
        <p className="mt-2 text-sm text-emerald-700/90" role="status">
          🌱 Embudo saludable. Mantén el ritmo.
        </p>
      )}
    </div>
  )
}
