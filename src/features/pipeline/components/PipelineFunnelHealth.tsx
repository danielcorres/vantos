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
import { InfoPopover } from '../../../shared/components/InfoPopover'

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

  const inventarioStatuses = statuses.filter((s) => s.kind === 'inventario')
  const avanceStatuses = statuses.filter((s) => s.kind === 'avance')

  if (stages.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 px-3 py-2.5">
        <p className="text-xs font-medium text-neutral-600">Mi Embudo</p>
        <p className="text-sm text-neutral-400 mt-0.5">—</p>
      </div>
    )
  }

  const Chip = ({ m }: { m: FunnelMetricStatus }) => (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${STATUS_STYLES[m.status]}`}
      title={`${m.label}: ${m.value} / ${m.target} (${m.status})`}
    >
      <span className="text-neutral-600 shrink-0">{m.label}</span>
      <span className="tabular-nums">{m.value}</span>
      <span className="text-neutral-500 font-normal">/</span>
      <span className="tabular-nums">{m.target}</span>
      <span className="sr-only">({m.status})</span>
    </span>
  )

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50/40 px-3 py-2.5">
      <p className="text-xs font-medium text-neutral-600 mb-2">Mi Embudo</p>
      <div className="mb-2">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs text-neutral-500">Inventario hoy</span>
          <InfoPopover
            title="Inventario"
            bullets={['Cuántos leads están ahora en esa etapa.']}
            className="text-neutral-400 hover:text-neutral-600"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {inventarioStatuses.map((m) => (
            <Chip key={m.slug} m={m} />
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs text-neutral-500">Avance hoy</span>
          <InfoPopover
            title="Avance"
            bullets={['Cuántos leads están ahora en etapa de primera cita, cierre o póliza.']}
            className="text-neutral-400 hover:text-neutral-600"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {avanceStatuses.map((m) => (
            <Chip key={m.slug} m={m} />
          ))}
        </div>
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
