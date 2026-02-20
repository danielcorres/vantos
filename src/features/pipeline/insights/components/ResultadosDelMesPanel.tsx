import type { MonthlyProductionCounts } from '../insights.types'

const METAS: { slug: keyof MonthlyProductionCounts; label: string; target: number }[] = [
  { slug: 'casos_abiertos', label: '1ª cita', target: 8 },
  { slug: 'citas_cierre', label: 'Cierre', target: 5 },
  { slug: 'casos_ganados', label: 'Póliza', target: 4 },
]

const STATUS_STYLES = {
  green: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  amber: 'bg-amber-50 border-amber-200 text-amber-800',
  red: 'bg-red-50/80 border-red-200/80 text-red-800',
} as const

type Status = keyof typeof STATUS_STYLES

function statusFor(value: number, target: number): Status {
  if (target <= 0) return 'green'
  const pct = value / target
  if (pct >= 1) return 'green'
  if (pct >= 0.8) return 'amber'
  return 'red'
}

interface ResultadosDelMesPanelProps {
  counts: MonthlyProductionCounts | null
  loading: boolean
}

export function ResultadosDelMesPanel({
  counts,
  loading,
}: ResultadosDelMesPanelProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-neutral-50/40 px-3 py-2.5 mb-4">
        <p className="text-xs font-medium text-neutral-600 mb-2">Resultados del mes</p>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-7 w-24 rounded-md border border-neutral-200 bg-neutral-100 animate-pulse"
              aria-hidden
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50/40 px-3 py-2.5 mb-4">
      <p className="text-xs font-medium text-neutral-600 mb-2">Resultados del mes</p>
      <p className="text-xs text-neutral-500 mb-2">
        Entradas a cada etapa en el mes (por historial de etapas).
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {METAS.map(({ slug, label, target }) => {
          const value = counts?.[slug] ?? 0
          const status = statusFor(value, target)
          return (
            <span
              key={slug}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${STATUS_STYLES[status]}`}
              title={`${label}: ${value} / ${target} este mes`}
            >
              <span className="text-neutral-600 shrink-0">{label}</span>
              <span className="tabular-nums">{value}</span>
              <span className="text-neutral-500 font-normal">/</span>
              <span className="tabular-nums">{target}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
