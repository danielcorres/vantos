import { useEffect, useReducer, useState, useRef, useMemo, useCallback, lazy, Suspense } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { pipelineApi, type Lead } from './pipeline.api'
import {
  pipelineReducer,
  generateIdempotencyKey,
  type PipelineState,
} from './pipeline.store'
import { KanbanBoard } from './components/KanbanBoard'
import { LeadCreateModal } from './components/LeadCreateModal'
import { PipelineTableView } from './views/PipelineTableView'
import { getWeeklyEntryLeads } from '../productivity/api/drilldown.api'

const PipelineInsightsPage = lazy(() =>
  import('./insights/PipelineInsightsPage').then((m) => ({ default: m.PipelineInsightsPage }))
)
import type { StageSlug } from '../productivity/types/productivity.types'
import { STAGE_SLUGS_ORDER } from '../productivity/types/productivity.types'
import { Toast } from '../../shared/components/Toast'
import { displayStageName } from '../../shared/utils/stageStyles'
import type { CreateLeadInput } from './pipeline.api'
import { NextActionModal } from '../../components/pipeline/NextActionModal'
import {
  type NextActionFilter,
  countLeadsByNextAction,
  filterLeadsByNextAction,
} from '../../shared/utils/nextAction'

const WEEKLY_STAGE_LABELS: Record<StageSlug, string> = {
  contactos_nuevos: 'Prospecto',
  citas_agendadas: 'Diagnóstico',
  casos_abiertos: 'Propuesta',
  citas_cierre: 'Decisión',
  solicitudes_ingresadas: 'Emisión',
  casos_ganados: 'Ganado (Cerrado)',
}

function isValidWeekStartYmd(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
}

function formatWeekRangeLabel(weekStartYmd: string): string {
  const [y, m, d] = weekStartYmd.split('-').map(Number)
  const mon = new Date(y, m - 1, d)
  const sun = new Date(y, m - 1, d + 6)
  const fmt = (date: Date) => date.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
  return `${fmt(mon)} – ${fmt(sun)}`
}

const STORAGE_KEY_VIEW = 'pipeline:viewMode'
type ViewMode = 'table' | 'kanban' | 'insights'

type PipelineToast = { type: 'error' | 'success' | 'info'; message: string } | null

function getStoredViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY_VIEW)
    if (v === 'table' || v === 'kanban' || v === 'insights') return v
  } catch (_) {}
  return 'table'
}

function setStoredViewMode(mode: ViewMode) {
  try {
    localStorage.setItem(STORAGE_KEY_VIEW, mode)
  } catch (_) {}
}

const initialState: PipelineState = {
  stages: [],
  leads: [],
  loading: true,
  error: null,
}

export function PipelinePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<ViewMode>(getStoredViewMode)
  const [pipelineToast, setPipelineToast] = useState<PipelineToast>(null)
  const [state, dispatch] = useReducer(pipelineReducer, initialState)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [createStageId, setCreateStageId] = useState<string | undefined>(undefined)
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null)
  const [pendingMove, setPendingMove] = useState<{
    leadId: string
    fromStageId: string
    toStageId: string
  } | null>(null)
  const naParam = searchParams.get('na')
  const validNa = naParam === 'overdue' || naParam === 'today' || naParam === 'week' || naParam === 'later'
  const [nextActionFilter, setNextActionFilterState] = useState<NextActionFilter>(validNa ? naParam : 'week')
  const kanbanRef = useRef<HTMLDivElement>(null)

  const setNextActionFilter = useCallback(
    (filter: NextActionFilter) => {
      setNextActionFilterState(filter)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('na', filter)
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const weekStartYmd = searchParams.get('weekStart')
  const weekStartValid = weekStartYmd != null && isValidWeekStartYmd(weekStartYmd)
  const stageSlugParam = searchParams.get('stage')
  const stageSlugValid =
    stageSlugParam != null && (STAGE_SLUGS_ORDER as readonly string[]).includes(stageSlugParam)
  const stageSlug = stageSlugValid ? (stageSlugParam as StageSlug) : (STAGE_SLUGS_ORDER[0] as StageSlug)
  const weeklyMode = Boolean(weekStartValid && stageSlugValid)

  const [weeklyLeadIds, setWeeklyLeadIds] = useState<Set<string> | null>(null)
  const [weeklyLoadError, setWeeklyLoadError] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    setStoredViewMode(activeTab)
  }, [activeTab])

  useEffect(() => {
    if (validNa && naParam) setNextActionFilterState(naParam)
  }, [naParam, validNa])

  useEffect(() => {
    if (!weekStartValid || !stageSlugValid || !weekStartYmd) {
      setWeeklyLeadIds(null)
      setWeeklyLoadError(null)
      return
    }
    setWeeklyLoadError(null)
    getWeeklyEntryLeads(weekStartYmd, stageSlug)
      .then((rows) => setWeeklyLeadIds(new Set(rows.map((r) => r.lead_id))))
      .catch(() => setWeeklyLoadError('No se pudieron cargar entradas de la semana'))
  }, [weekStartValid, stageSlugValid, weekStartYmd, stageSlug])

  useEffect(() => {
    const leadId = searchParams.get('lead')
    if (leadId && state.leads.length > 0) {
      setActiveTab('kanban')
      setTimeout(() => {
        kanbanRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete('lead')
        return next
      }, { replace: true })
    }
  }, [searchParams, state.leads.length, setSearchParams])

  const displayedLeads = useMemo(() => {
    if (!weeklyMode) return state.leads
    if (weeklyLeadIds === null) return []
    return state.leads.filter((l) => weeklyLeadIds.has(l.id))
  }, [weeklyMode, weeklyLeadIds, state.leads])

  const nextActionCounts = useMemo(
    () => countLeadsByNextAction(displayedLeads),
    [displayedLeads]
  )

  const leadsFilteredByNextAction = useMemo(
    () => filterLeadsByNextAction(displayedLeads, nextActionFilter),
    [displayedLeads, nextActionFilter]
  )

  const hasSetNextActionDefault = useRef(false)
  useEffect(() => {
    if (displayedLeads.length === 0 || hasSetNextActionDefault.current || validNa) return
    hasSetNextActionDefault.current = true
    const c = countLeadsByNextAction(displayedLeads)
    if (c.overdue > 0) setNextActionFilter('overdue')
    else if (c.today > 0) setNextActionFilter('today')
  }, [displayedLeads, validNa])

  const [tableVisibleCount, setTableVisibleCount] = useState<number | null>(null)

  const clearWeeklyMode = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('stage')
      next.delete('weekStart')
      return next
    }, { replace: true })
  }

  const loadData = async () => {
    dispatch({ type: 'LOAD_START' })
    try {
      const [stages, leads] = await Promise.all([
        pipelineApi.getStages(),
        pipelineApi.getLeads('activos'),
      ])
      dispatch({ type: 'LOAD_SUCCESS', payload: { stages, leads } })
    } catch (err: unknown) {
      dispatch({ type: 'LOAD_ERROR', payload: err instanceof Error ? err.message : 'Error al cargar datos' })
    }
  }

  const handleCreateLead = async (data: CreateLeadInput) => {
    const newLead = await pipelineApi.createLead(data)
    dispatch({ type: 'CREATE_LEAD', payload: newLead })
    setIsModalOpen(false)
  }

  const handleCreateLeadFromStage = useCallback((stageId: string) => {
    setCreateStageId(stageId)
    setIsModalOpen(true)
  }, [])

  const handleDragStart = useCallback((e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', lead.id)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent, toStageId: string) => {
      e.preventDefault()
      if (!draggedLead) return
      const fromStageId = draggedLead.stage_id
      const prevStageChangedAt = draggedLead.stage_changed_at ?? null
      if (fromStageId === toStageId) {
        setDraggedLead(null)
        return
      }
      if (draggedLead.next_action_at == null) {
        setPendingMove({ leadId: draggedLead.id, fromStageId, toStageId })
        setDraggedLead(null)
        return
      }
      dispatch({
        type: 'MOVE_OPTIMISTIC',
        payload: {
          leadId: draggedLead.id,
          fromStageId,
          toStageId,
          prevStageChangedAt,
        },
      })
      const idempotencyKey = generateIdempotencyKey(
        draggedLead.id,
        fromStageId,
        toStageId
      )
      try {
        await pipelineApi.moveLeadStage(draggedLead.id, toStageId, idempotencyKey)
        await loadData()
      } catch (err: unknown) {
        dispatch({
          type: 'MOVE_ROLLBACK',
          payload: {
            leadId: draggedLead.id,
            fromStageId,
            prevStageChangedAt,
          },
        })
        setPipelineToast({
          type: 'error',
          message: 'No se pudo mover la etapa. Intenta nuevamente.',
        })
      } finally {
        setDraggedLead(null)
      }
    },
    [draggedLead, dispatch]
  )

  /**
   * Mobile Kanban no usa drag&drop. Reutilizamos la misma lógica de movimiento
   * (optimistic + idempotency + reload) que el drop del tablero.
   */
  const handleMoveStage = useCallback(async (leadId: string, toStageId: string) => {
    const lead = state.leads.find((l) => l.id === leadId)
    if (!lead) return
    const fromStageId = lead.stage_id
    const prevStageChangedAt = lead.stage_changed_at ?? null
    if (fromStageId === toStageId) return

    if (lead.next_action_at == null) {
      setPendingMove({ leadId, fromStageId, toStageId })
      return
    }

    const scrollY = window.scrollY
    const stageName = state.stages.find((s) => s.id === toStageId)?.name

    dispatch({
      type: 'MOVE_OPTIMISTIC',
      payload: {
        leadId,
        fromStageId,
        toStageId,
        prevStageChangedAt,
      },
    })
    const idempotencyKey = generateIdempotencyKey(leadId, fromStageId, toStageId)
    try {
      await pipelineApi.moveLeadStage(leadId, toStageId, idempotencyKey)
      await loadData()
      setPipelineToast({
        type: 'success',
        message: stageName ? `Movido a ${displayStageName(stageName)}` : 'Etapa actualizada',
      })
    } catch (err: unknown) {
      dispatch({
        type: 'MOVE_ROLLBACK',
        payload: {
          leadId,
          fromStageId,
          prevStageChangedAt,
        },
      })
      setPipelineToast({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error al mover',
      })
    } finally {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: scrollY, left: window.scrollX, behavior: 'auto' })
        })
      })
    }
  }, [state.leads, state.stages, dispatch])

  const handleViewInKanban = (leadId?: string) => {
    setActiveTab('kanban')
    if (leadId && kanbanRef.current) {
      setTimeout(() => {
        kanbanRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }

  if (state.loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">Pipeline</h1>
            <p className="text-sm text-muted">Seguimiento de tus oportunidades activas</p>
          </div>
        </div>
        <div className="text-center p-8">
          <span className="text-muted">Cargando...</span>
        </div>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">Pipeline</h1>
            <p className="text-sm text-muted">Seguimiento de tus oportunidades activas</p>
          </div>
        </div>
        <div className="card p-4 bg-red-50 border border-red-200">
          <p className="text-sm text-red-700 mb-3">{state.error}</p>
          <button onClick={() => loadData()} className="btn btn-primary text-sm">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold mb-1">Pipeline</h1>
          <p className="text-sm text-muted">Seguimiento de tus oportunidades activas</p>
        </div>
        {activeTab === 'kanban' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary text-sm"
          >
            + Nuevo lead
          </button>
        )}
      </div>

      {/* Filtros por próxima acción (America/Monterrey) */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: 'overdue' as const, label: 'Se me pasó', emoji: '🔴' },
            { key: 'today' as const, label: 'Hoy', emoji: '🟡' },
            { key: 'week' as const, label: 'Esta semana', emoji: '🟢' },
            { key: 'later' as const, label: 'Más adelante', emoji: '⚪' },
          ] as const
        ).map(({ key, label, emoji }) => (
          <button
            key={key}
            type="button"
            onClick={() => setNextActionFilter(key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              nextActionFilter === key
                ? 'bg-neutral-900 text-white border-neutral-900'
                : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            <span aria-hidden>{emoji}</span>
            <span>{label}</span>
            <span className="tabular-nums text-xs opacity-90">({nextActionCounts[key]})</span>
          </button>
        ))}
      </div>

      {weekStartValid && weekStartYmd && !stageSlugValid && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 dark:bg-neutral-800/40 px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-sm text-neutral-700 dark:text-neutral-300">
            Semana seleccionada · Elige una etapa para ver entradas
          </span>
          <label htmlFor="pipeline-weekly-stage-pick" className="sr-only">
            Etapa
          </label>
          <select
            id="pipeline-weekly-stage-pick"
            value={stageSlugValid ? stageSlugParam : ''}
            onChange={(e) => {
              const slug = e.target.value
              if (!slug) return
              setSearchParams(
                (prev) => {
                  const next = new URLSearchParams(prev)
                  next.set('stage', slug)
                  if (weekStartYmd) next.set('weekStart', weekStartYmd)
                  return next
                },
                { replace: true }
              )
            }}
            className="px-2 py-1 text-sm rounded border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
          >
            <option value="">— Elige etapa —</option>
            {(STAGE_SLUGS_ORDER as readonly string[]).map((slug) => (
              <option key={slug} value={slug}>
                {WEEKLY_STAGE_LABELS[slug as StageSlug]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={clearWeeklyMode}
            className="text-sm text-neutral-600 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/10 px-2 py-1 rounded transition-colors ml-auto"
          >
            Quitar
          </button>
        </div>
      )}

      {weeklyMode && weekStartYmd && (weeklyLeadIds !== null || weeklyLoadError) && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 dark:bg-neutral-800/40 px-4 py-3 flex flex-wrap items-center gap-3">
          <span className="text-sm text-neutral-700 dark:text-neutral-300">
            {weeklyLoadError ? (
              weeklyLoadError
            ) : (
              <>
                Entradas de la semana · {formatWeekRangeLabel(weekStartYmd)}
                <label htmlFor="pipeline-weekly-stage" className="sr-only">
                  Etapa
                </label>
                <select
                  id="pipeline-weekly-stage"
                  value={stageSlug}
                  onChange={(e) => {
                    const slug = e.target.value
                    setSearchParams(
                      (prev) => {
                        const next = new URLSearchParams(prev)
                        next.set('stage', slug)
                        if (weekStartYmd) next.set('weekStart', weekStartYmd)
                        return next
                      },
                      { replace: true }
                    )
                  }}
                  className="ml-2 px-2 py-1 text-sm rounded border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                >
                  {(STAGE_SLUGS_ORDER as readonly string[]).map((slug) => (
                    <option key={slug} value={slug}>
                      {WEEKLY_STAGE_LABELS[slug as StageSlug]}
                    </option>
                  ))}
                </select>
              </>
            )}
          </span>
          {!weeklyLoadError && (
            <span className="text-sm text-neutral-600 dark:text-neutral-400 tabular-nums">
              Mostrando: {activeTab === 'table' ? (tableVisibleCount ?? displayedLeads.length) : displayedLeads.length}
            </span>
          )}
          <button
            type="button"
            onClick={() => navigate(`/productividad?weekStart=${weekStartYmd}`)}
            className="text-sm text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white border border-neutral-300 dark:border-neutral-600 hover:border-neutral-400 dark:hover:border-neutral-500 px-2.5 py-1 rounded transition-colors"
          >
            Ver Productividad
          </button>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(window.location.href).then(() =>
                setPipelineToast({ type: 'success', message: 'Link copiado' })
              )
            }}
            className="text-sm text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10 px-2 py-1 rounded transition-colors"
            title="Copiar link"
            aria-label="Copiar link"
          >
            Copiar link
          </button>
          <button
            type="button"
            onClick={clearWeeklyMode}
            className="text-sm text-neutral-600 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/10 px-2 py-1 rounded transition-colors ml-auto"
          >
            Quitar
          </button>
        </div>
      )}

      <div
        className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100/80 p-0.5 gap-0.5"
        role="tablist"
        aria-label="Vista del pipeline"
      >
        <button
          role="tab"
          aria-selected={activeTab === 'table'}
          onClick={() => setActiveTab('table')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            activeTab === 'table' ? 'bg-white text-neutral-900 ring-1 ring-neutral-200 font-medium' : 'text-neutral-600 hover:bg-neutral-200/60'
          }`}
        >
          Tabla
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'kanban'}
          onClick={() => setActiveTab('kanban')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            activeTab === 'kanban' ? 'bg-white text-neutral-900 ring-1 ring-neutral-200 font-medium' : 'text-neutral-600 hover:bg-neutral-200/60'
          }`}
        >
          Kanban
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'insights'}
          onClick={() => setActiveTab('insights')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            activeTab === 'insights' ? 'bg-white text-neutral-900 ring-1 ring-neutral-200 font-medium' : 'text-neutral-600 hover:bg-neutral-200/60'
          }`}
        >
          Insights
        </button>
      </div>

      {activeTab === 'table' && (
        <PipelineTableView
          weeklyFilterLeadIds={weeklyMode ? weeklyLeadIds : null}
          weeklyStageLabel={weeklyMode && stageSlug ? WEEKLY_STAGE_LABELS[stageSlug] : null}
          weeklyWeekRange={weeklyMode && weekStartYmd ? formatWeekRangeLabel(weekStartYmd) : null}
          weeklyLoadError={weeklyMode ? weeklyLoadError : null}
          onClearWeekly={clearWeeklyMode}
          onVisibleCountChange={setTableVisibleCount}
          onToast={(msg) => setPipelineToast({ type: 'success', message: msg })}
          nextActionFilter={nextActionFilter}
        />
      )}

      {activeTab === 'kanban' && weeklyMode && displayedLeads.length === 0 && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 dark:bg-neutral-800/40 p-8 text-center">
          <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
            No hubo entradas a esta etapa en la semana seleccionada.
          </p>
          <button
            type="button"
            onClick={clearWeeklyMode}
            className="text-sm text-neutral-600 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-black/5 px-2 py-1 rounded transition-colors"
          >
            Quitar filtro
          </button>
        </div>
      )}

      {activeTab === 'kanban' && (!weeklyMode || displayedLeads.length > 0) && (
        <div ref={kanbanRef}>
          <KanbanBoard
            stages={state.stages}
            leads={leadsFilteredByNextAction}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onMoveStage={handleMoveStage}
            onCreateLead={handleCreateLeadFromStage}
            onToast={(msg) => setPipelineToast({ type: 'success', message: msg })}
            onUpdated={loadData}
          />
        </div>
      )}

      {activeTab === 'insights' && (
        <Suspense
          fallback={
            <div className="rounded-lg border border-border bg-bg/50 p-6 flex items-center justify-center min-h-[200px]">
              <div className="flex flex-col items-center gap-2">
                <div className="h-2 w-32 rounded-full bg-black/10 animate-pulse" />
                <span className="text-sm text-muted">Cargando insights…</span>
              </div>
            </div>
          }
        >
          <PipelineInsightsPage onViewInKanban={handleViewInKanban} />
        </Suspense>
      )}

      {activeTab === 'kanban' && (
        <LeadCreateModal
          stages={state.stages}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setCreateStageId(undefined)
          }}
          onSubmit={handleCreateLead}
          onCancelNextAction={() =>
            setPipelineToast({ type: 'info', message: 'Creación cancelada' })
          }
          defaultStageId={createStageId}
        />
      )}

      <NextActionModal
        isOpen={pendingMove != null}
        onClose={() => setPendingMove(null)}
        onSave={async (next_action_at, next_action_type) => {
          if (!pendingMove) return
          try {
            await pipelineApi.updateLead(pendingMove.leadId, { next_action_at, next_action_type })
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'No se pudo guardar la próxima acción.'
            setPipelineToast({ type: 'error', message: msg })
            return
          }
          try {
            const idempotencyKey = generateIdempotencyKey(
              pendingMove.leadId,
              pendingMove.fromStageId,
              pendingMove.toStageId
            )
            await pipelineApi.moveLeadStage(pendingMove.leadId, pendingMove.toStageId, idempotencyKey)
          } catch (err: unknown) {
            setPipelineToast({
              type: 'error',
              message:
                'Se guardó la próxima acción pero no se pudo mover la etapa. Intenta mover de nuevo.',
            })
            await loadData()
            return
          }
          await loadData()
          const stageName = state.stages.find((s) => s.id === pendingMove.toStageId)?.name
          setPipelineToast({
            type: 'success',
            message: stageName ? `Movido a ${displayStageName(stageName)}` : 'Etapa actualizada',
          })
          setPendingMove(null)
        }}
        title="Definir próxima acción para mover"
      />

      {pipelineToast && (
        <Toast
          message={pipelineToast.message}
          type={pipelineToast.type}
          onClose={() => setPipelineToast(null)}
          durationMs={2200}
        />
      )}
    </div>
  )
}
