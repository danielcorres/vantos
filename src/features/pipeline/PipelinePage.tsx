import { useEffect, useReducer, useState, useRef, useMemo, useCallback } from 'react'
import { subscribeGoogleCalendarSyncErrors } from '../calendar/utils/googleCalendarSyncListeners'
import {
  getSchedulingGuidance,
  type LeadSchedulingSummary,
  type SchedulingGuidance,
} from '../calendar/utils/stageSchedulingGuidance'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { pipelineApi, type Lead, PIPELINE_STAGE_PAGE_SIZE } from './pipeline.api'
import {
  pipelineReducer,
  generateIdempotencyKey,
  type PipelineState,
} from './pipeline.store'
import { KanbanBoard } from './components/KanbanBoard'
import { LeadCreateModal } from './components/LeadCreateModal'
import { PostCreateCalendarAskDialog } from './components/PostCreateCalendarAskDialog'
import {
  AppointmentFormModal,
  type AppointmentEditFocus,
} from '../calendar/components/AppointmentFormModal'
import type { AppointmentType } from '../calendar/types/calendar.types'
import { PipelineRecordsView } from './views/PipelineRecordsView'
import { getWeeklyEntryLeads } from '../productivity/api/drilldown.api'

import type { StageSlug } from '../productivity/types/productivity.types'
import { STAGE_SLUGS_ORDER } from '../productivity/types/productivity.types'
import { Toast } from '../../shared/components/Toast'
import { displayStageName } from '../../shared/utils/stageStyles'
import type { CreateLeadInput } from './pipeline.api'
import { calendarApi } from '../calendar/api/calendar.api'
import type { CalendarEvent } from '../calendar/types/calendar.types'
import { resolveCalModalFromGuidance } from './utils/resolveCalModalFromGuidance'

const WEEKLY_STAGE_LABELS: Record<StageSlug, string> = {
  contactos_nuevos: 'Contactos',
  citas_agendadas: 'Citas Agendadas',
  casos_abiertos: 'Casos Abiertos',
  citas_cierre: 'Citas de Cierre',
  solicitudes_ingresadas: 'Solicitudes Ingresadas',
  casos_ganados: 'Pólizas Pagadas',
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
type ViewMode = 'pipeline' | 'records'

type PipelineToast = { type: 'error' | 'success' | 'info'; message: string } | null

function getStoredViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY_VIEW)
    if (v === 'pipeline' || v === 'records') return v
  } catch {
    /* intentionally ignored */
  }
  return 'records'
}

function setStoredViewMode(mode: ViewMode) {
  try {
    localStorage.setItem(STORAGE_KEY_VIEW, mode)
  } catch {
    /* intentionally ignored */
  }
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
  const [postCreateAskLead, setPostCreateAskLead] = useState<Lead | null>(null)
  type CalModalState =
    | null
    | {
        mode: 'create'
        leadId: string
        initialAppointmentType?: AppointmentType | null
        initialTitle?: string | null
        lockType?: AppointmentType | null
        helpText?: string | null
      }
    | {
        mode: 'edit'
        leadId: string
        event: CalendarEvent
        helpText?: string | null
        editFocus?: AppointmentEditFocus
      }

  const [calModal, setCalModal] = useState<CalModalState>(null)
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null)
  const kanbanRef = useRef<HTMLDivElement>(null)

  const [nextAppointmentByLeadId, setNextAppointmentByLeadId] = useState<
    Record<string, CalendarEvent | null>
  >({})
  const [schedulingSummaryByLeadId, setSchedulingSummaryByLeadId] = useState<
    Record<string, LeadSchedulingSummary>
  >({})

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
    if (state.loading || state.leads.length === 0) {
      setNextAppointmentByLeadId({})
      setSchedulingSummaryByLeadId({})
      return
    }
    const ids = [...new Set(state.leads.map((l) => l.id))]
    let cancelled = false
    void Promise.all([calendarApi.getNextScheduledEventByLeadIds(ids), calendarApi.getSchedulingSummaries(ids)])
      .then(([map, summaries]) => {
        if (!cancelled) {
          setNextAppointmentByLeadId(map)
          setSchedulingSummaryByLeadId(summaries)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNextAppointmentByLeadId({})
          setSchedulingSummaryByLeadId({})
        }
      })
    return () => {
      cancelled = true
    }
  }, [state.loading, state.leads])

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
      setActiveTab('pipeline')
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

  const schedulingGuidanceByLeadId = useMemo(() => {
    const out: Record<string, SchedulingGuidance> = {}
    for (const lead of displayedLeads) {
      const slug = state.stages.find((s) => s.id === lead.stage_id)?.slug
      out[lead.id] = getSchedulingGuidance(
        lead,
        slug,
        nextAppointmentByLeadId[lead.id] ?? null,
        schedulingSummaryByLeadId[lead.id]
      )
    }
    return out
  }, [displayedLeads, state.stages, nextAppointmentByLeadId, schedulingSummaryByLeadId])

  useEffect(() => {
    if (!weeklyMode || weeklyLeadIds === null || weeklyLeadIds.size === 0) return
    const ids = [...weeklyLeadIds]
    let cancelled = false
    void pipelineApi.getLeadsByIds(ids).then((rows) => {
      if (!cancelled) dispatch({ type: 'UPSERT_LEADS', payload: { leads: rows } })
    })
    return () => {
      cancelled = true
    }
  }, [weeklyMode, weeklyLeadIds, dispatch])

  const [pipelineMode, setPipelineMode] = useState<'activos' | 'archivados'>('activos')
  const [groupByStage, setGroupByStage] = useState(true)
  const [tableCounts, setTableCounts] = useState({ activos: 0, archivados: 0 })
  const [tableVisibleCount, setTableVisibleCount] = useState<number | null>(null)
  const [stageLoadMeta, setStageLoadMeta] = useState<Record<string, { total: number; loaded: number }>>({})
  const [kanbanStageLoadingMore, setKanbanStageLoadingMore] = useState<string | null>(null)
  const stageLoadMetaRef = useRef(stageLoadMeta)
  useEffect(() => {
    stageLoadMetaRef.current = stageLoadMeta
  }, [stageLoadMeta])

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
      const stages = await pipelineApi.getStages()
      const stageIds = stages.map((s) => s.id)
      const [counts, activosTotal, archTotal] = await Promise.all([
        pipelineApi.getActiveLeadCountsByStages(stageIds),
        pipelineApi.getActiveLeadsTotalCount(),
        pipelineApi.getArchivedLeadsTotalCount(),
      ])
      const pages = await Promise.all(
        stageIds.map((sid) =>
          pipelineApi.getLeadsForStage(sid, { offset: 0, limit: PIPELINE_STAGE_PAGE_SIZE })
        )
      )
      const leads = pages.flat()
      const meta: Record<string, { total: number; loaded: number }> = {}
      stageIds.forEach((sid, i) => {
        meta[sid] = { total: counts[sid] ?? 0, loaded: pages[i].length }
      })
      setStageLoadMeta(meta)
      setTableCounts({ activos: activosTotal, archivados: archTotal })
      dispatch({ type: 'LOAD_SUCCESS', payload: { stages, leads } })
    } catch (err: unknown) {
      dispatch({ type: 'LOAD_ERROR', payload: err instanceof Error ? err.message : 'Error al cargar datos' })
    }
  }

  const applyMoveOptimistic = useCallback(
    (leadId: string, fromStageId: string, toStageId: string, prevStageChangedAt: string | null) => {
      dispatch({
        type: 'MOVE_OPTIMISTIC',
        payload: { leadId, fromStageId, toStageId, prevStageChangedAt },
      })
    },
    [dispatch]
  )

  const applyMoveRollback = useCallback(
    (leadId: string, fromStageId: string, prevStageChangedAt: string | null) => {
      dispatch({
        type: 'MOVE_ROLLBACK',
        payload: { leadId, fromStageId, prevStageChangedAt },
      })
    },
    [dispatch]
  )

  /** Refetch completo (primera página por etapa + conteos). */
  const refreshDataSilent = useCallback(async () => {
    try {
      let stages = state.stages
      if (!stages.length) {
        stages = await pipelineApi.getStages()
      }
      const stageIds = stages.map((s) => s.id)
      const [counts, activosTotal, archTotal] = await Promise.all([
        pipelineApi.getActiveLeadCountsByStages(stageIds),
        pipelineApi.getActiveLeadsTotalCount(),
        pipelineApi.getArchivedLeadsTotalCount(),
      ])
      const pages = await Promise.all(
        stageIds.map((sid) =>
          pipelineApi.getLeadsForStage(sid, { offset: 0, limit: PIPELINE_STAGE_PAGE_SIZE })
        )
      )
      const leads = pages.flat()
      const meta: Record<string, { total: number; loaded: number }> = {}
      stageIds.forEach((sid, i) => {
        meta[sid] = { total: counts[sid] ?? 0, loaded: pages[i].length }
      })
      setStageLoadMeta(meta)
      setTableCounts({ activos: activosTotal, archivados: archTotal })
      dispatch({ type: 'LOAD_SUCCESS', payload: { stages, leads } })
    } catch (err: unknown) {
      dispatch({ type: 'LOAD_ERROR', payload: err instanceof Error ? err.message : 'Error al cargar datos' })
    }
  }, [dispatch, state.stages])

  const refreshAffectedStages = useCallback(
    async (fromStageId: string, toStageId: string) => {
      const ids = fromStageId === toStageId ? [fromStageId] : [fromStageId, toStageId]
      const metaNow = stageLoadMetaRef.current
      try {
        const counts = await pipelineApi.getActiveLeadCountsByStages(ids)
        const pages = await Promise.all(
          ids.map((sid) => {
            const cap = Math.max(metaNow[sid]?.loaded ?? 0, PIPELINE_STAGE_PAGE_SIZE)
            return pipelineApi.getLeadsForStage(sid, { offset: 0, limit: cap })
          })
        )
        dispatch({ type: 'REFRESH_STAGES_DATA', payload: { stageIds: ids, leads: pages.flat() } })
        setStageLoadMeta((m) => {
          const next = { ...m }
          ids.forEach((sid, i) => {
            next[sid] = { total: counts[sid] ?? 0, loaded: pages[i].length }
          })
          return next
        })
      } catch {
        await refreshDataSilent()
      }
    },
    [dispatch, refreshDataSilent]
  )

  const handleLoadMoreStage = useCallback(async (stageId: string) => {
    const meta = stageLoadMetaRef.current[stageId]
    if (!meta || meta.loaded >= meta.total) return
    setKanbanStageLoadingMore(stageId)
    try {
      const next = await pipelineApi.getLeadsForStage(stageId, {
        offset: meta.loaded,
        limit: PIPELINE_STAGE_PAGE_SIZE,
      })
      if (next.length === 0) return
      dispatch({ type: 'APPEND_LEADS', payload: { leads: next } })
      setStageLoadMeta((m) => ({
        ...m,
        [stageId]: {
          total: m[stageId]?.total ?? 0,
          loaded: (m[stageId]?.loaded ?? 0) + next.length,
        },
      }))
    } finally {
      setKanbanStageLoadingMore(null)
    }
  }, [dispatch])

  const handleCreateLead = async (data: CreateLeadInput) => {
    const newLead = await pipelineApi.createLead(data)
    dispatch({ type: 'CREATE_LEAD', payload: newLead })
    await refreshAffectedStages(newLead.stage_id, newLead.stage_id)
    return newLead
  }

  const clearCalModal = useCallback(() => {
    setCalModal(null)
  }, [])

  const openAppointmentEditFromChip = useCallback(
    (args: { leadId: string; event: CalendarEvent; focus: AppointmentEditFocus }) => {
      setCalModal({
        mode: 'edit',
        leadId: args.leadId,
        event: args.event,
        helpText: null,
        editFocus: args.focus,
      })
    },
    []
  )

  const openScheduleForLead = useCallback(
    async (leadId: string) => {
      const r = await resolveCalModalFromGuidance(leadId, {
        leads: state.leads,
        stages: state.stages,
        nextAppointmentByLeadId,
        schedulingSummaryByLeadId,
      })
      if (r.kind === 'toast') {
        setPipelineToast({ type: r.level, message: r.message })
        return
      }
      if (r.kind === 'edit') {
        setCalModal({
          mode: 'edit',
          leadId: r.leadId,
          event: r.event,
          helpText: r.helpText,
          editFocus: undefined,
        })
        return
      }
      setCalModal({
        mode: 'create',
        leadId: r.leadId,
        initialAppointmentType: r.initialAppointmentType,
        initialTitle: r.initialTitle,
        lockType: r.lockType,
        helpText: r.helpText,
      })
    },
    [state.leads, state.stages, nextAppointmentByLeadId, schedulingSummaryByLeadId]
  )

  useEffect(() => {
    return subscribeGoogleCalendarSyncErrors((msg) => {
      setPipelineToast({ type: 'error', message: msg })
    })
  }, [])

  const handleLeadCreatedForCalendar = useCallback((lead: Lead) => {
    setPostCreateAskLead(lead)
  }, [])

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
        await refreshAffectedStages(fromStageId, toStageId)
        const stageName = state.stages.find((s) => s.id === toStageId)?.name
        setPipelineToast({
          type: 'success',
          message: stageName ? `Movido a ${displayStageName(stageName)}` : 'Etapa actualizada',
        })
      } catch {
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
    [draggedLead, dispatch, refreshAffectedStages, state.stages]
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
      await refreshAffectedStages(fromStageId, toStageId)
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
  }, [state.leads, state.stages, dispatch, refreshAffectedStages])

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
        {activeTab === 'pipeline' && (
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
              Mostrando: {activeTab === 'records' ? (tableVisibleCount ?? displayedLeads.length) : displayedLeads.length}
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

      {/* FILA 1: Lista | Kanban */}
      <div className="flex flex-wrap items-center gap-2">
        <div
          className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100/80 p-0.5 gap-0.5"
          role="tablist"
          aria-label="Vista del pipeline"
        >
          <button
            role="tab"
            aria-selected={activeTab === 'records'}
            onClick={() => setActiveTab('records')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'records' ? 'bg-white text-neutral-900 ring-1 ring-neutral-200 font-medium' : 'text-neutral-600 hover:bg-neutral-200/60'
            }`}
          >
            Lista
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'pipeline'}
            onClick={() => setActiveTab('pipeline')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              activeTab === 'pipeline' ? 'bg-white text-neutral-900 ring-1 ring-neutral-200 font-medium' : 'text-neutral-600 hover:bg-neutral-200/60'
            }`}
          >
            Kanban
          </button>
        </div>
      </div>

      {/* FILA 2: Activos | Archivados — Agrupar por etapa | Vista plana (solo en vista records) */}
      {activeTab === 'records' && (
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100/80 p-0.5 gap-0.5"
            role="tablist"
            aria-label="Modo del pipeline"
          >
            <button
              role="tab"
              aria-selected={pipelineMode === 'activos'}
              onClick={() => setPipelineMode('activos')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors inline-flex items-center gap-1.5 ${
                pipelineMode === 'activos' ? 'bg-white text-neutral-900 ring-1 ring-neutral-200 font-medium' : 'text-neutral-600 hover:bg-neutral-200/60'
              }`}
            >
              Activos <span className={`rounded-full text-[10px] px-1.5 py-0.5 tabular-nums ${pipelineMode === 'activos' ? 'bg-neutral-800 text-white/90' : 'bg-neutral-200/80 text-neutral-500'}`}>{tableCounts.activos}</span>
            </button>
            <button
              role="tab"
              aria-selected={pipelineMode === 'archivados'}
              onClick={() => setPipelineMode('archivados')}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors inline-flex items-center gap-1.5 ${
                pipelineMode === 'archivados' ? 'bg-white text-neutral-900 ring-1 ring-neutral-200 font-medium' : 'text-neutral-600 hover:bg-neutral-200/60'
              }`}
            >
              Archivados <span className={`rounded-full text-[10px] px-1.5 py-0.5 tabular-nums ${pipelineMode === 'archivados' ? 'bg-neutral-800 text-white/90' : 'bg-neutral-200/80 text-neutral-500'}`}>{tableCounts.archivados}</span>
            </button>
          </div>
          <div
            className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100/80 p-0.5 gap-0.5"
            role="group"
            aria-label="Vista de tabla"
          >
            <button
              type="button"
              aria-pressed={groupByStage}
              onClick={() => setGroupByStage(true)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                groupByStage ? 'bg-white text-neutral-900 ring-1 ring-neutral-200 font-medium' : 'text-neutral-600 hover:bg-neutral-200/60'
              }`}
            >
              Agrupar por etapa
            </button>
            <button
              type="button"
              aria-pressed={!groupByStage}
              onClick={() => setGroupByStage(false)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                !groupByStage ? 'bg-white text-neutral-900 ring-1 ring-neutral-200 font-medium' : 'text-neutral-600 hover:bg-neutral-200/60'
              }`}
            >
              Vista plana
            </button>
          </div>
        </div>
      )}

      {activeTab === 'records' && (
        <PipelineRecordsView
          activosLeads={activeTab === 'records' ? null : displayedLeads}
          nextAppointmentByLeadId={nextAppointmentByLeadId}
          pipelineMode={pipelineMode}
          groupByStage={groupByStage}
          onCountsChange={setTableCounts}
          onRefreshActivos={refreshDataSilent}
          onMoveStageOptimistic={applyMoveOptimistic}
          onMoveStageRollback={applyMoveRollback}
          weeklyFilterLeadIds={weeklyMode ? weeklyLeadIds : null}
          weeklyStageLabel={weeklyMode && stageSlug ? WEEKLY_STAGE_LABELS[stageSlug] : null}
          weeklyWeekRange={weeklyMode && weekStartYmd ? formatWeekRangeLabel(weekStartYmd) : null}
          weeklyLoadError={weeklyMode ? weeklyLoadError : null}
          onClearWeekly={clearWeeklyMode}
          onVisibleCountChange={setTableVisibleCount}
          onToast={(msg) => setPipelineToast({ type: 'success', message: msg })}
        />
      )}

      {activeTab === 'pipeline' && weeklyMode && displayedLeads.length === 0 && (
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

      {activeTab === 'pipeline' && (!weeklyMode || displayedLeads.length > 0) && (
        <div ref={kanbanRef}>
          <KanbanBoard
            stages={state.stages}
            leads={displayedLeads}
            nextAppointmentByLeadId={nextAppointmentByLeadId}
            stageLoadMeta={stageLoadMeta}
            loadingMoreStageId={kanbanStageLoadingMore}
            onLoadMoreStage={handleLoadMoreStage}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onMoveStage={handleMoveStage}
            onCreateLead={handleCreateLeadFromStage}
            onToast={(msg) => setPipelineToast({ type: 'success', message: msg })}
            onUpdated={refreshDataSilent}
            onSchedule={openScheduleForLead}
            onEditAppointment={openAppointmentEditFromChip}
            schedulingGuidanceByLeadId={schedulingGuidanceByLeadId}
          />
        </div>
      )}

      {activeTab === 'pipeline' && (
        <LeadCreateModal
          stages={state.stages}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false)
            setCreateStageId(undefined)
          }}
          onSubmit={handleCreateLead}
          onLeadCreated={handleLeadCreatedForCalendar}
          defaultStageId={createStageId}
        />
      )}

      <PostCreateCalendarAskDialog
        isOpen={postCreateAskLead != null}
        onAgendar={() => {
          const lead = postCreateAskLead
          if (!lead) return
          const slug = state.stages.find((s) => s.id === lead.stage_id)?.slug
          const g = getSchedulingGuidance(lead, slug, null, undefined)
          setCalModal({
            mode: 'create',
            leadId: lead.id,
            initialAppointmentType: g.suggestedType,
            initialTitle: g.suggestedTitle,
            lockType: null,
            helpText: g.helpText,
          })
          setPostCreateAskLead(null)
        }}
        onSkip={() => setPostCreateAskLead(null)}
      />

      {calModal != null && calModal.mode === 'create' && (
        <AppointmentFormModal
          key={`create-${calModal.leadId}-${calModal.initialAppointmentType ?? 'default'}-${calModal.lockType ?? 'x'}`}
          isOpen
          onClose={clearCalModal}
          mode="create"
          onSaved={() => {
            void refreshDataSilent()
          }}
          initialLeadId={calModal.leadId}
          createDefaults={{ durationMinutes: 30 }}
          initialAppointmentType={calModal.initialAppointmentType ?? undefined}
          initialTitle={calModal.initialTitle ?? undefined}
          lockType={calModal.lockType ?? null}
          helpText={calModal.helpText ?? null}
        />
      )}

      {calModal != null && calModal.mode === 'edit' && (
        <AppointmentFormModal
          key={`edit-${calModal.event.id}-${calModal.editFocus ?? 'none'}`}
          isOpen
          onClose={clearCalModal}
          mode="edit"
          event={calModal.event}
          onSaved={() => {
            void refreshDataSilent()
          }}
          helpText={calModal.helpText ?? null}
          initialEditFocus={calModal.editFocus ?? null}
        />
      )}

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
