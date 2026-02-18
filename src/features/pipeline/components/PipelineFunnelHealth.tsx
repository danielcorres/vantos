import { useMemo } from 'react'
import type { Lead } from '../pipeline.api'
import type { PipelineStage } from '../pipeline.api'
import {
  getStageCounts,
  getMonthlyProduction,
  computeFunnelStatus,
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

/** Color suave del número para ritmo de producción (solo texto, sin fondo). */
const PACE_TONE_NUMBER: Record<string, string> = {
  red: 'text-red-600',
  amber: 'text-amber-700',
  green: 'text-emerald-700',
  ahead: 'text-emerald-700',
}

type PipelineFunnelHealthProps = {
  /** Lista completa de leads activos del asesor. No debe ser filtrada por próxima acción, búsqueda ni vista. */
  leads: Lead[]
  stages: PipelineStage[]
  /** Opcional: fecha para prorrateo mensual; por defecto hoy. */
  monthContext?: Date
}

export function PipelineFunnelHealth({
  leads,
  stages,
  monthContext = new Date(),
}: PipelineFunnelHealthProps) {
  const { statuses, suggestion, allGreen } = useMemo(() => {
    const inventoryCounts = getStageCounts(leads, stages)
    const monthlyProduction = getMonthlyProduction(leads, monthContext)
    const statuses = computeFunnelStatus(inventoryCounts, monthlyProduction, monthContext)
    const suggestion = pickPrimarySuggestion(statuses)
    const allGreen = isAllGreen(statuses)
    return { statuses, suggestion, allGreen }
  }, [leads, stages, monthContext])

  const stockStatuses = statuses.filter((s) => s.kind === 'stock')
  const monthlyStatuses = statuses.filter((s) => s.kind === 'monthly')

  if (stages.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-neutral-50/50 px-3 py-2.5">
        <p className="text-xs font-medium text-neutral-600">Mi Embudo</p>
        <p className="text-sm text-neutral-400 mt-0.5">—</p>
      </div>
    )
  }

  const StockChip = ({ m }: { m: FunnelMetricStatus }) => (
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

  const paceEmoji: Record<string, string> = {
    needs_push: '🔴',
    in_progress: '🟡',
    on_track: '🟢',
    ahead: '🔥',
  }

  const ProductionChip = ({ m }: { m: FunnelMetricStatus }) => {
    const tone = m.paceTone ?? 'amber'
    const numClass = PACE_TONE_NUMBER[tone] ?? 'text-neutral-700'
    const paceLabel = m.paceLabel ?? 'En progreso'
    const emoji = m.paceStatusKey ? paceEmoji[m.paceStatusKey] : '🟡'
    return (
      <span
        className="inline-flex flex-col rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs"
        title={`${m.label}: ${m.value} / ${m.target} · ${paceLabel}`}
      >
        <span className="inline-flex items-center gap-1.5 font-medium">
          <span className="text-neutral-600 shrink-0">{m.label}</span>
          <span className={`tabular-nums ${numClass}`}>
            {m.value}/{m.target}
          </span>
        </span>
        <span className="text-[10px] text-neutral-500 mt-0.5 hidden sm:block">
          {emoji} {paceLabel}
        </span>
      </span>
    )
  }

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
          {stockStatuses.map((m) => (
            <StockChip key={m.slug} m={m} />
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs text-neutral-500">Producción del mes</span>
          <InfoPopover
            title="Producción"
            bullets={['Cuántos eventos ocurrieron en el mes (1ª cita, cierre, póliza).']}
            className="text-neutral-400 hover:text-neutral-600"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {monthlyStatuses.map((m) => (
            <ProductionChip key={m.slug} m={m} />
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
