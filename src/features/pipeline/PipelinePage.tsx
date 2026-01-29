import { useEffect, useReducer, useState, useRef, useMemo, lazy, Suspense } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { pipelineApi, type Lead } from './pipeline.api'
import {
  pipelineReducer,
  generateIdempotencyKey,
  type PipelineState,
} from './pipeline.store'
import { KanbanBoard } from './components/KanbanBoard'
import { LeadCreateModal } from './components/LeadCreateModal'
import { ScheduleFirstMeetingModal } from './components/ScheduleFirstMeetingModal'
import { PipelineTableView } from './views/PipelineTableView'
import { AppointmentFormModal } from '../calendar/components/AppointmentFormModal'
import type { AppointmentType } from '../calendar/types/calendar.types'
import { getWeeklyEntryLeads } from '../productivity/api/drilldown.api'

const PipelineInsightsPage = lazy(() =>
  import('./insights/PipelineInsightsPage').then((m) => ({ default: m.PipelineInsightsPage }))
)
import type { StageSlug } from '../productivity/types/productivity.types'
import { STAGE_SLUGS_ORDER } from '../productivity/types/productivity.types'
import { Toast } from '../../shared/components/Toast'

const WEEKLY_STAGE_LABELS: Record<StageSlug, string> = {
  contactos_nuevos: 'Contactos Nuevos',
  citas_agendadas: 'Citas Agendadas',
  casos_abiertos: 'Casos Abiertos',
  citas_cierre: 'Citas de Cierre',
  solicitudes_ingresadas: 'Solicitudes Ingresadas',
  casos_ganados: 'Casos Ganados',
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
  const [pipelineToast, setPipelineToast] = useState<string | null>(null)
  const [state, dispatch] = useReducer(pipelineReducer, initialState)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null)
  const kanbanRef = useRef<HTMLDivElement>(null)

  const weekStartYmd = searchParams.get('weekStart')
  const weekStartValid = weekStartYmd != null && isValidWeekStartYmd(weekStartYmd)
  const stageSlugParam = searchParams.get('stage')
  const stageSlugValid = stageSlugParam != null && (STAGE_SLUGS_ORDER as readonly string[]).includes(stageSlugParam)
  const stageSlug = stageSlugValid ? (stageSlugParam as StageSlug) : (STAGE_SLUGS_ORDER[0] as StageSlug)
  const weeklyMode = Boolean(weekStartValid && stageSlugValid)

  const [weeklyLeadIds, setWeeklyLeadIds] = useState<Set<string> | null>(null)
  const [weeklyLoadError, setWeeklyLoadError] = useState<string | null>(null)
  const [pendingScheduleFirstMeeting, setPendingScheduleFirstMeeting] = useState<{
    leadId: string
    intentSlug: StageSlug | null
  } | null>(null)
  const tableRefreshRef = useRef<(() => void) | null>(null)
  const [appointmentFlow, setAppointmentFlow] = useState<{ leadId: string; type: 'first_meeting' | 'closing' } | null>(null)
  const [pendingAppointmentCancel, setPendingAppointmentCancel] = useState<{ leadId: string; type: 'first_meeting' | 'closing' } | null>(null)
  const [showAppointmentCancelConfirm, setShowAppointmentCancelConfirm] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    setStoredViewMode(activeTab)
  }, [activeTab])

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
    if (weeklyLeadIds === null) return [] // loading/error: no mostrar totales globales en Kanban
    return state.leads.filter((l) => weeklyLeadIds.has(l.id))
  }, [weeklyMode, weeklyLeadIds, state.leads])

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

  const handleCreateLead = async (data: {
    full_name: string
    phone?: string
    email?: string
    source?: string
    notes?: string
    stage_id: string
  }) => {
    const selectedStage = state.stages.find((s) => s.id === data.stage_id)
    const contactosNuevosStage = state.stages.find((s) => s.slug === 'contactos_nuevos') ?? state.stages[0]
    const stageIdToUse = contactosNuevosStage?.id ?? data.stage_id

    const newLead = await pipelineApi.createLead({
      ...data,
      stage_id: stageIdToUse,
    })
    dispatch({ type: 'CREATE_LEAD', payload: newLead })
    setIsModalOpen(false)

    setPendingScheduleFirstMeeting({
      leadId: newLead.id,
      intentSlug: (selectedStage?.slug as StageSlug) ?? null,
    })
  }

  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    setDraggedLead(lead)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', lead.id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e: React.DragEvent, toStageId: string) => {
    e.preventDefault()
    if (!draggedLead) return
    const fromStageId = draggedLead.stage_id
    if (fromStageId === toStageId) {
      setDraggedLead(null)
      return
    }
    dispatch({
      type: 'MOVE_OPTIMISTIC',
      payload: { leadId: draggedLead.id, toStageId },
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
        payload: { leadId: draggedLead.id, fromStageId },
      })
      alert(err instanceof Error ? err.message : 'Error al mover el lead')
    } finally {
      setDraggedLead(null)
    }
  }

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
              const slug = e.target.value as StageSlug
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
            {STAGE_SLUGS_ORDER.map((slug) => (
              <option key={slug} value={slug}>
                {WEEKLY_STAGE_LABELS[slug]}
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
                    const slug = e.target.value as StageSlug
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
                  {STAGE_SLUGS_ORDER.map((slug) => (
                    <option key={slug} value={slug}>
                      {WEEKLY_STAGE_LABELS[slug]}
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
              void navigator.clipboard.writeText(window.location.href).then(() => setPipelineToast('Link copiado'))
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
          weeklyStageLabel={weeklyMode && stageSlug ? WEEKLY_STAGE_LABELS[stageSlug as StageSlug] ?? stageSlug : null}
          weeklyWeekRange={weeklyMode && weekStartYmd ? formatWeekRangeLabel(weekStartYmd) : null}
          weeklyLoadError={weeklyMode ? weeklyLoadError : null}
          onClearWeekly={clearWeeklyMode}
          onVisibleCountChange={setTableVisibleCount}
          onLeadCreated={(lead, intentSlug) =>
            setPendingScheduleFirstMeeting({ leadId: lead.id, intentSlug })
          }
          onRegisterRefresh={(fn) => {
            tableRefreshRef.current = fn
          }}
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
            leads={displayedLeads}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
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
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreateLead}
        />
      )}

      {pendingScheduleFirstMeeting && (
        <ScheduleFirstMeetingModal
          isOpen={true}
          onClose={() => setPendingScheduleFirstMeeting(null)}
          intentSlug={pendingScheduleFirstMeeting.intentSlug}
          onAgendar={() => {
            setAppointmentFlow({
              leadId: pendingScheduleFirstMeeting.leadId,
              type: pendingScheduleFirstMeeting.intentSlug === 'citas_cierre' ? 'closing' : 'first_meeting',
            })
            setPendingScheduleFirstMeeting(null)
          }}
          onDecline={() => setPipelineToast('Listo. Lead creado en Contactos nuevos.')}
        />
      )}

      {pipelineToast && (
        <Toast
          message={pipelineToast}
          type="success"
          onClose={() => setPipelineToast(null)}
          durationMs={2200}
        />
      )}

      {appointmentFlow && (
        <AppointmentFormModal
          isOpen={true}
          onClose={() => {
            setPendingAppointmentCancel(appointmentFlow)
            setAppointmentFlow(null)
            setShowAppointmentCancelConfirm(true)
          }}
          mode="create"
          onSaved={() => {
            loadData()
            tableRefreshRef.current?.()
            setAppointmentFlow(null)
          }}
          initialLeadId={appointmentFlow.leadId}
          lockType={appointmentFlow.type as AppointmentType}
          createDefaults={{ durationMinutes: 30, startsAtOffsetHours: 1, roundToMinutes: 30 }}
        />
      )}

      {showAppointmentCancelConfirm && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
          onClick={() => setShowAppointmentCancelConfirm(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="appointment-cancel-title"
        >
          <div
            className="bg-bg border border-border rounded-xl shadow-xl w-full max-w-sm p-4 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="appointment-cancel-title" className="text-sm font-semibold text-text">
              Esta etapa requiere una cita. ¿Qué prefieres?
            </h3>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  if (pendingAppointmentCancel) {
                    setAppointmentFlow(pendingAppointmentCancel)
                    setPendingAppointmentCancel(null)
                  }
                  setShowAppointmentCancelConfirm(false)
                }}
                className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90"
              >
                Agendar cita
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingAppointmentCancel(null)
                  setShowAppointmentCancelConfirm(false)
                }}
                className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-border bg-bg hover:bg-black/5"
              >
                Dejar en Contactos Nuevos
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!pendingAppointmentCancel) {
                    setShowAppointmentCancelConfirm(false)
                    return
                  }
                  const casosAbiertosStage = state.stages.find((s) => s.slug === 'casos_abiertos')
                  if (casosAbiertosStage) {
                    try {
                      const lead = state.leads.find((l) => l.id === pendingAppointmentCancel.leadId)
                      if (lead) {
                        await pipelineApi.moveLeadStage(
                          lead.id,
                          casosAbiertosStage.id,
                          generateIdempotencyKey(lead.id, lead.stage_id, casosAbiertosStage.id)
                        )
                        await loadData()
                      }
                    } catch (_) {}
                  }
                  setPendingAppointmentCancel(null)
                  setShowAppointmentCancelConfirm(false)
                }}
                className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-border bg-bg hover:bg-black/5"
              >
                Cambiar a Casos Abiertos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
