import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { getWeeklyProductivity } from '../features/productivity/api/productivity.api'
import { getWeeklyGoals } from '../features/productivity/api/goals.api'
import { WeeklyGoalsModal } from '../features/productivity/components/WeeklyGoalsModal'
import { StageDrilldownModal } from '../features/productivity/components/StageDrilldownModal'
import type { WeeklyProductivity, StageSlug } from '../features/productivity/types/productivity.types'
import { STAGE_SLUGS_ORDER } from '../features/productivity/types/productivity.types'
import { todayLocalYmd, addDaysYmd } from '../shared/utils/dates'
import { IconArrowRight } from '../app/layout/icons'

const DEFAULT_GOALS: Record<StageSlug, number> = {
  contactos_nuevos: 20,
  citas_agendadas: 8,
  casos_abiertos: 6,
  citas_cierre: 3,
  solicitudes_ingresadas: 1,
  casos_ganados: 1,
}

const STAGE_LABELS: Record<StageSlug, string> = {
  contactos_nuevos: 'Contactos Nuevos',
  citas_agendadas: 'Citas Agendadas',
  casos_abiertos: 'Casos Abiertos',
  citas_cierre: 'Citas de Cierre',
  solicitudes_ingresadas: 'Solicitudes Ingresadas',
  casos_ganados: 'Casos Ganados',
}

const TOOLTIP_TEXT = 'Cuenta cuántos leads entraron a esta etapa esta semana.'

function getMondayOfWeekYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const day = dt.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return addDaysYmd(ymd, diff)
}

function formatShortDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatWeekRange(weekStartYmd: string): string {
  const sunYmd = addDaysYmd(weekStartYmd, 6)
  return `${formatShortDate(weekStartYmd)} – ${formatShortDate(sunYmd)}`
}

function isValidWeekStartYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

function getWeekStartFromSearchParams(searchParams: URLSearchParams): string {
  const w = searchParams.get('weekStart')
  if (w && isValidWeekStartYmd(w)) return getMondayOfWeekYmd(w)
  return getMondayOfWeekYmd(todayLocalYmd())
}

export function ProductivityPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const weekStartYmd = getWeekStartFromSearchParams(searchParams)

  const [data, setData] = useState<WeeklyProductivity | null>(null)
  const [goals, setGoals] = useState<Record<StageSlug, number>>(DEFAULT_GOALS)
  const [goalsLoaded, setGoalsLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [goalsModalOpen, setGoalsModalOpen] = useState(false)
  const [drilldownSlug, setDrilldownSlug] = useState<StageSlug | null>(null)

  const loadGoals = useCallback(async () => {
    try {
      const g = await getWeeklyGoals()
      if (g) setGoals(g)
    } catch {
      // Mantener defaults si falla
    } finally {
      setGoalsLoaded(true)
    }
  }, [])

  useEffect(() => {
    loadGoals()
  }, [loadGoals])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getWeeklyProductivity(weekStartYmd)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar')
    } finally {
      setLoading(false)
    }
  }, [weekStartYmd])

  useEffect(() => {
    load()
  }, [load])

  // Sincronizar URL: si no hay weekStart, escribir semana actual (replace para no apilar historial)
  useEffect(() => {
    if (!searchParams.get('weekStart')) {
      setSearchParams({ weekStart: getMondayOfWeekYmd(todayLocalYmd()) }, { replace: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- solo al montar

  const goPrev = () => setSearchParams({ weekStart: addDaysYmd(weekStartYmd, -7) }, { replace: true })
  const goNext = () => setSearchParams({ weekStart: addDaysYmd(weekStartYmd, 7) }, { replace: true })
  const goToday = () => setSearchParams({ weekStart: getMondayOfWeekYmd(todayLocalYmd()) }, { replace: true })

  const counts = data?.counts ?? ({} as Record<StageSlug, number>)
  let maxGapRel = 0
  let focusSlug: StageSlug | null = null
  let focusMissing = 0
  for (const slug of STAGE_SLUGS_ORDER) {
    const meta = goals[slug] ?? 0
    const actual = counts[slug] ?? 0
    if (meta > 0 && actual < meta) {
      const gapRel = (meta - actual) / meta
      if (gapRel > maxGapRel) {
        maxGapRel = gapRel
        focusSlug = slug
        focusMissing = meta - actual
      }
    }
  }

  return (
    <div className="flex flex-col min-h-0">
      <header className="shrink-0 px-4 py-3 border-b border-border bg-surface/50">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold text-text">Productividad semanal</h1>
            <p className="text-sm text-muted mt-0.5">Semana del {formatWeekRange(weekStartYmd)}</p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <button
                type="button"
                onClick={goPrev}
                className="px-2.5 py-1.5 text-sm rounded-lg border border-border bg-bg hover:bg-black/5"
                aria-label="Semana anterior"
              >
                ← anterior
              </button>
              <button
                type="button"
                onClick={goToday}
                className="px-2.5 py-1.5 text-sm rounded-lg border border-border bg-bg hover:bg-black/5"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={goNext}
                className="px-2.5 py-1.5 text-sm rounded-lg border border-border bg-bg hover:bg-black/5"
                aria-label="Semana siguiente"
              >
                siguiente →
              </button>
            </div>
          </div>
          {goalsLoaded && (
            <button
              type="button"
              onClick={() => setGoalsModalOpen(true)}
              className="px-2.5 py-1.5 text-sm text-muted hover:text-text hover:bg-black/5 rounded-lg transition-colors"
            >
              Editar metas
            </button>
          )}
        </div>
      </header>

      <WeeklyGoalsModal
        isOpen={goalsModalOpen}
        onClose={() => setGoalsModalOpen(false)}
        initialGoals={goals}
        onSaved={setGoals}
      />

      {drilldownSlug && (
        <StageDrilldownModal
          isOpen={true}
          onClose={() => setDrilldownSlug(null)}
          stageSlug={drilldownSlug}
          stageLabel={STAGE_LABELS[drilldownSlug]}
          weekStartYmd={weekStartYmd}
        />
      )}

      <main className="flex-1 overflow-auto p-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm p-4 mb-4 flex items-center justify-between gap-2">
            <span>{error}</span>
            <button
              type="button"
              onClick={load}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-red-300 hover:bg-red-100 dark:hover:bg-red-900/40"
            >
              Reintentar
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-lg border border-border bg-bg/50 p-3">
                <div className="h-4 w-2/3 bg-black/10 rounded animate-pulse mb-2" />
                <div className="h-2 w-full bg-black/5 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {STAGE_SLUGS_ORDER.map((slug) => {
                const actual = counts[slug] ?? 0
                const meta = goals[slug] ?? 0
                const pct = meta > 0 ? Math.min(actual / meta, 1) : 0
                const isOnTrack = actual >= meta
                const missing = meta > 0 ? Math.max(0, meta - actual) : 0

                return (
                  <div
                    key={slug}
                    className="rounded-lg border border-border bg-bg/50 p-3"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-text">
                        {STAGE_LABELS[slug]}
                        <span
                          className="inline-flex size-4 items-center justify-center rounded-full bg-neutral-200/80 text-neutral-500 text-[10px] cursor-help"
                          title={TOOLTIP_TEXT}
                          aria-label={TOOLTIP_TEXT}
                        >
                          i
                        </span>
                      </span>
                      <span className="flex items-center gap-2 flex-wrap justify-end">
                        <span className="text-sm tabular-nums text-muted">
                          {actual} / {meta}
                        </span>
                        {/* Desktop: Entradas + badge; móvil: chip solo número + icon Pipeline */}
                        <span className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDrilldownSlug(slug)}
                            className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-neutral-200 dark:border-border bg-white/60 dark:bg-bg/60 hover:bg-white dark:hover:bg-bg text-text text-xs transition-colors"
                            aria-label={`Ver entradas de ${STAGE_LABELS[slug]}`}
                            title="Entradas"
                          >
                            Entradas
                            <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 tabular-nums font-medium">
                              {actual}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDrilldownSlug(slug)}
                            className="sm:hidden h-8 px-2 rounded-lg border border-neutral-200 dark:border-border bg-white/60 dark:bg-bg/60 hover:bg-white dark:hover:bg-bg text-text text-sm font-medium tabular-nums transition-colors"
                            title="Entradas"
                            aria-label={`Ver entradas de ${STAGE_LABELS[slug]}`}
                          >
                            {actual}
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/pipeline?stage=${slug}&weekStart=${weekStartYmd}`)}
                            className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1.5 text-xs text-muted hover:text-text hover:bg-black/5 rounded-lg border border-transparent hover:border-border transition-colors"
                            title="Ver en Pipeline"
                            aria-label="Ver en Pipeline"
                          >
                            Pipeline
                            <IconArrowRight className="w-3.5 h-3.5 shrink-0" />
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/pipeline?stage=${slug}&weekStart=${weekStartYmd}`)}
                            className="sm:hidden inline-flex items-center justify-center h-8 w-8 rounded-lg border border-neutral-200 dark:border-border bg-white/60 dark:bg-bg/60 hover:bg-white dark:hover:bg-bg text-muted hover:text-text transition-colors"
                            title="Ver en Pipeline"
                            aria-label="Ver en Pipeline"
                          >
                            <IconArrowRight className="w-4 h-4" />
                          </button>
                        </span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full bg-primary/70 transition-all duration-300"
                        style={{ width: `${pct * 100}%` }}
                      />
                    </div>
                    <div className="flex justify-end">
                      {isOnTrack ? (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                          Al día
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                          Faltan {missing}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {focusSlug && (
              <div className="mt-6 rounded-lg border border-border bg-amber-50/50 dark:bg-amber-900/10 p-4">
                <h3 className="text-sm font-semibold text-text mb-1">Enfoque sugerido</h3>
                <p className="text-sm text-muted">
                  <span className="font-medium text-text">{STAGE_LABELS[focusSlug]}</span>
                  <br />
                  Te faltan {focusMissing} para tu meta semanal
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
