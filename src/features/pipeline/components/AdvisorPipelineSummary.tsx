import type { AdvisorPipelineSummaryData } from '../types/advisorPipeline.types'
import { displayStageName, getStageAccentStyle, getStageTagClasses } from '../../../shared/utils/stageStyles'

type Props = {
  data: AdvisorPipelineSummaryData | null
  loading: boolean
  error: string | null
  weekRangeLabel: string
  /** Semana calendario actual (lunes inicio) */
  isCurrentWeek: boolean
}

function SkeletonRows() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-10 rounded-md bg-black/5 dark:bg-white/10 animate-pulse"
        />
      ))}
    </div>
  )
}

export function AdvisorPipelineSummary({
  data,
  loading,
  error,
  weekRangeLabel,
  isCurrentWeek,
}: Props) {
  const isEmpty =
    data != null && data.totalActive === 0 && data.weekEntriesTotal === 0

  return (
    <div className="card overflow-hidden">
      <div className="p-4 border-b border-border dark:border-neutral-800">
        <h2 className="text-lg font-semibold text-text dark:text-neutral-100">
          Pipeline del Asesor (Semana seleccionada)
        </h2>
        <p className="text-sm text-muted dark:text-neutral-400 mt-1">
          Semana: {weekRangeLabel}
          {isCurrentWeek ? (
            <span className="ml-2 text-xs font-medium text-amber-700 dark:text-amber-300">
              (semana en curso)
            </span>
          ) : null}
        </p>
      </div>

      {error && (
        <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border-b border-red-100 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900/50">
          {error}
        </div>
      )}

      {loading && <SkeletonRows />}

      {!loading && data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border-b border-border dark:border-neutral-800 bg-bg/50 dark:bg-neutral-900/40">
            <div>
              <div className="text-xs font-semibold text-muted uppercase tracking-wide">
                Activos hoy
              </div>
              <div className="text-xl font-semibold text-text dark:text-neutral-100 mt-0.5">
                {data.totalActive}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted uppercase tracking-wide">
                Nuevos (entrada sem.)
              </div>
              <div className="text-xl font-semibold text-text dark:text-neutral-100 mt-0.5">
                {data.newThisWeek}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted uppercase tracking-wide">
                Ganados (sem.)
              </div>
              <div className="text-xl font-semibold text-text dark:text-neutral-100 mt-0.5">
                {data.wonThisWeek}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-muted uppercase tracking-wide">
                % en etapa ganada
              </div>
              <div className="text-xl font-semibold text-text dark:text-neutral-100 mt-0.5">
                {data.conversionPct != null ? `${data.conversionPct}%` : '—'}
              </div>
              <div className="text-[10px] text-muted mt-0.5 leading-tight">
                Snapshot: activos en «casos ganados» / total activos
              </div>
            </div>
          </div>

          {isEmpty ? (
            <div className="p-6 text-center">
              <p className="text-sm font-medium text-text dark:text-neutral-200">
                Sin actividad de pipeline en esta semana
              </p>
              <p className="text-xs text-muted dark:text-neutral-400 mt-2 max-w-md mx-auto">
                No hay leads activos ni movimientos de etapa registrados en el rango seleccionado.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bg border-b border-border dark:bg-neutral-900 dark:border-neutral-800">
                  <tr>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase">
                      Etapa
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-muted uppercase min-w-[10rem]">
                      Activos hoy
                    </th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-muted uppercase whitespace-nowrap">
                      Entradas sem.
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => {
                    const pct =
                      data.totalActive > 0
                        ? Math.min(100, (row.current_count / data.totalActive) * 100)
                        : 0
                    return (
                      <tr
                        key={row.slug || row.position}
                        className="border-b border-border dark:border-neutral-800 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                      >
                        <td className="py-3 px-4 align-middle" style={getStageAccentStyle(row.slug)}>
                          <div className="flex items-center gap-2 pl-1">
                            <span className={getStageTagClasses(row.slug)}>
                              {displayStageName(row.stage_name)}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 align-middle">
                          <div className="flex items-center gap-2 min-w-[8rem]">
                            <span className="font-semibold tabular-nums w-8 text-right shrink-0">
                              {row.current_count}
                            </span>
                            <div className="flex-1 h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden min-w-[4rem]">
                              <div
                                className="h-full rounded-full bg-primary/70 dark:bg-neutral-200"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right align-middle tabular-nums font-medium text-text dark:text-neutral-100">
                          {row.week_entries > 0 ? row.week_entries : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-4 py-2 border-t border-border dark:border-neutral-800 bg-bg/30 dark:bg-neutral-900/30">
            <p className="text-[11px] text-muted dark:text-neutral-500">
              Movimientos: cuenta por lead y etapa de destino en la semana (sin retrocesos). Zona horaria
              America/Monterrey.
            </p>
          </div>
        </>
      )}

      {!loading && !data && !error && (
        <div className="p-4 text-sm text-muted">Sin datos de pipeline.</div>
      )}
    </div>
  )
}
