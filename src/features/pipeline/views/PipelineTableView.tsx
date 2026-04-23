import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  pipelineApi,
  type Lead,
  type PipelineStage,
  type CreateLeadInput,
  PIPELINE_STAGE_PAGE_SIZE,
} from '../pipeline.api'
import { generateIdempotencyKey } from '../pipeline.store'
import { LeadCreateModal } from '../components/LeadCreateModal'
import { PostCreateCalendarAskDialog } from '../components/PostCreateCalendarAskDialog'
import { AppointmentFormModal } from '../../calendar/components/AppointmentFormModal'
import type { AppointmentType } from '../../calendar/types/calendar.types'
import { NextActionModal } from '../../../components/pipeline/NextActionModal'
import { PipelineTable } from '../components/PipelineTable'
import { Toast } from '../../../shared/components/Toast'
import { formatDateMX } from '../../../shared/utils/dates'
import { getStageTagClasses, getStageAccentStyle, displayStageName } from '../../../shared/utils/stageStyles'
import { LeadTemperatureChip } from '../../../components/pipeline/LeadTemperatureChip'
import { LeadSourceTag } from '../../../components/pipeline/LeadSourceTag'
import type { CalendarEvent } from '../../calendar/types/calendar.types'
import { calendarApi } from '../../calendar/api/calendar.api'
import { subscribeGoogleCalendarSyncErrors } from '../../calendar/utils/googleCalendarSyncListeners'
import {
  getSchedulingGuidance,
  type LeadSchedulingSummary,
  type SchedulingGuidance,
} from '../../calendar/utils/stageSchedulingGuidance'
import { resolveCalModalFromGuidance } from '../utils/resolveCalModalFromGuidance'

const BTN_PRIMARY =
  'h-9 rounded-xl bg-neutral-900 text-white px-4 text-sm font-semibold gap-2 hover:bg-neutral-800 active:scale-[0.98] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 focus-visible:ring-offset-1 flex-shrink-0 inline-flex items-center justify-center'

// Orden dentro de cada etapa: next_follow_up_at asc (más próximo arriba), nulls last.
function sortLeadsByPriority(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => {
    const aAt = a.next_follow_up_at ? new Date(a.next_follow_up_at).getTime() : null
    const bAt = b.next_follow_up_at ? new Date(b.next_follow_up_at).getTime() : null
    if (aAt != null && bAt != null) return aAt - bAt
    if (aAt != null && bAt == null) return -1
    if (aAt == null && bAt != null) return 1
    return 0
  })
}

export function PipelineTableView({
  activosLeads = null,
  nextAppointmentByLeadId,
  pipelineMode = 'activos',
  groupByStage = true,
  onCountsChange,
  onRefreshActivos,
  onMoveStageOptimistic,
  onMoveStageRollback,
  weeklyFilterLeadIds = null,
  weeklyLoadError = null,
  onClearWeekly,
  onVisibleCountChange,
  onToast,
}: {
  activosLeads?: Lead[] | null
  nextAppointmentByLeadId?: Record<string, CalendarEvent | null>
  pipelineMode?: 'activos' | 'archivados'
  groupByStage?: boolean
  onCountsChange?: (counts: { activos: number; archivados: number }) => void
  /** Cuando la tabla activa recibe activosLeads del padre, usa esto para refrescar el source of truth. */
  onRefreshActivos?: () => Promise<void>
  /** Optimistic update: mueve el lead visualmente antes del API. */
  onMoveStageOptimistic?: (leadId: string, fromStageId: string, toStageId: string, prevStageChangedAt: string | null) => void
  /** Rollback si el API falla. */
  onMoveStageRollback?: (leadId: string, fromStageId: string, prevStageChangedAt: string | null) => void
  weeklyFilterLeadIds?: Set<string> | null
  weeklyStageLabel?: string | null
  weeklyWeekRange?: string | null
  weeklyLoadError?: string | null
  onClearWeekly?: () => void
  onVisibleCountChange?: (n: number) => void
  onToast?: (message: string) => void
} = {}) {
  const navigate = useNavigate()
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
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
      }

  const [calModal, setCalModal] = useState<CalModalState>(null)
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({})
  const [highlightLeadId, setHighlightLeadId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  /** '' = todas; '__null__' = sin clasificar; frio|tibio|caliente */
  const [temperatureFilter, setTemperatureFilter] = useState('')
  const [restoreLeadPending, setRestoreLeadPending] = useState<Lead | null>(null)
  const [pendingMoveStage, setPendingMoveStage] = useState<{
    leadId: string
    fromStageId: string
    toStageId: string
  } | null>(null)
  const [serverActivosLeads, setServerActivosLeads] = useState<Lead[]>([])
  const [serverActivosTotal, setServerActivosTotal] = useState(0)
  const [activosListLoadedCount, setActivosListLoadedCount] = useState(0)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [listLoadingMore, setListLoadingMore] = useState(false)
  const [archivedTotal, setArchivedTotal] = useState(0)
  const [localNextAppointmentByLeadId, setLocalNextAppointmentByLeadId] = useState<
    Record<string, CalendarEvent | null>
  >({})
  const [localSchedulingSummaryByLeadId, setLocalSchedulingSummaryByLeadId] = useState<
    Record<string, LeadSchedulingSummary>
  >({})

  const weeklyMode = weeklyFilterLeadIds != null && weeklyLoadError == null

  const weeklyIdsKey = useMemo(() => {
    if (!weeklyFilterLeadIds || weeklyFilterLeadIds.size === 0) return ''
    return [...weeklyFilterLeadIds].sort().join(',')
  }, [weeklyFilterLeadIds])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350)
    return () => window.clearTimeout(t)
  }, [searchQuery])

  const serverActivosListMode = pipelineMode === 'activos' && activosLeads == null

  const baseLeads = useMemo(() => {
    if (pipelineMode !== 'activos') return leads
    if (activosLeads != null) return activosLeads
    return serverActivosLeads
  }, [pipelineMode, activosLeads, leads, serverActivosLeads])

  const stagesLite = useMemo(
    () => stages.map((s) => ({ id: s.id, name: s.name, position: s.position, slug: s.slug })),
    [stages]
  )

  const filteredLeads = useMemo(() => {
    if (pipelineMode !== 'activos') return []
    if (activosLeads == null) {
      let list = baseLeads
      if (weeklyMode && weeklyFilterLeadIds?.size) {
        list = list.filter((l) => weeklyFilterLeadIds.has(l.id))
      }
      return list
    }
    let list = baseLeads
    if (weeklyMode && weeklyFilterLeadIds?.size) {
      list = list.filter((l) => weeklyFilterLeadIds.has(l.id))
    }
    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (l) =>
          (l.full_name?.toLowerCase().includes(q)) ||
          (l.phone?.toLowerCase().includes(q)) ||
          (l.email?.toLowerCase().includes(q))
      )
    }
    const src = sourceFilter.trim()
    if (src) {
      const srcLower = src.toLowerCase()
      list = list.filter((l) => (l.source?.toLowerCase().trim() || '') === srcLower)
    }
    const temp = temperatureFilter.trim()
    if (temp === '__null__') {
      list = list.filter((l) => l.temperature == null)
    } else if (temp === 'frio' || temp === 'tibio' || temp === 'caliente') {
      list = list.filter((l) => l.temperature === temp)
    }
    return list
  }, [
    pipelineMode,
    activosLeads,
    baseLeads,
    searchQuery,
    sourceFilter,
    temperatureFilter,
    weeklyMode,
    weeklyFilterLeadIds,
  ])

  useEffect(() => {
    if (pipelineMode === 'activos' && activosLeads == null) {
      onVisibleCountChange?.(serverActivosTotal)
    } else {
      onVisibleCountChange?.(filteredLeads.length)
    }
  }, [pipelineMode, activosLeads, serverActivosTotal, filteredLeads.length, onVisibleCountChange])

  const sortedLeads = useMemo(
    () => sortLeadsByPriority(filteredLeads),
    [filteredLeads]
  )

  const sortedLeadIdsKey = useMemo(
    () =>
      [...new Set(sortedLeads.map((l) => l.id))]
        .sort()
        .join(','),
    [sortedLeads]
  )

  useEffect(() => {
    if (!sortedLeadIdsKey) {
      setLocalNextAppointmentByLeadId({})
      setLocalSchedulingSummaryByLeadId({})
      return
    }
    const ids = sortedLeadIdsKey.split(',').filter(Boolean)
    let cancelled = false
    void Promise.all([calendarApi.getNextScheduledEventByLeadIds(ids), calendarApi.getSchedulingSummaries(ids)])
      .then(([m, sums]) => {
        if (!cancelled) {
          setLocalNextAppointmentByLeadId(m)
          setLocalSchedulingSummaryByLeadId(sums)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLocalNextAppointmentByLeadId({})
          setLocalSchedulingSummaryByLeadId({})
        }
      })
    return () => {
      cancelled = true
    }
  }, [sortedLeadIdsKey])

  const mergedNextAppointmentByLeadId = useMemo(
    () => ({ ...localNextAppointmentByLeadId, ...(nextAppointmentByLeadId ?? {}) }),
    [localNextAppointmentByLeadId, nextAppointmentByLeadId]
  )

  const mergedSchedulingSummaryByLeadId = useMemo(
    () => ({ ...localSchedulingSummaryByLeadId }),
    [localSchedulingSummaryByLeadId]
  )

  const schedulingGuidanceByLeadId = useMemo(() => {
    const out: Record<string, SchedulingGuidance> = {}
    for (const lead of sortedLeads) {
      const slug = stages.find((s) => s.id === lead.stage_id)?.slug
      out[lead.id] = getSchedulingGuidance(
        lead,
        slug,
        mergedNextAppointmentByLeadId[lead.id] ?? null,
        mergedSchedulingSummaryByLeadId[lead.id]
      )
    }
    return out
  }, [sortedLeads, stages, mergedNextAppointmentByLeadId, mergedSchedulingSummaryByLeadId])

  const groupedSections = useMemo(() => {
    if (pipelineMode !== 'activos' || stages.length === 0) return []
    const byStage = new Map<string, Lead[]>()
    for (const lead of sortedLeads) {
      const list = byStage.get(lead.stage_id)
      if (list) list.push(lead)
      else byStage.set(lead.stage_id, [lead])
    }
    return stages.map((stage) => ({
      stage: { id: stage.id, name: stage.name, position: stage.position, slug: stage.slug },
      leads: byStage.get(stage.id) ?? [],
    }))
  }, [pipelineMode, stages, sortedLeads])

  const sectionsToRender = useMemo(() => {
    if (!groupByStage || pipelineMode !== 'activos') return []
    return groupedSections
  }, [groupByStage, pipelineMode, groupedSections])

  useEffect(() => {
    if (pipelineMode !== 'activos' || !groupedSections.length) return
    setCollapsedStages((prev) => {
      let next = prev
      for (const { stage, leads: sectionLeads } of groupedSections) {
        if (stage.id in next) continue
        // Lista activos paginada en servidor: una etapa puede tener 0 filas en esta página pero leads en BD.
        const collapseWhenEmpty = !serverActivosListMode && sectionLeads.length === 0
        next = { ...next, [stage.id]: collapseWhenEmpty }
      }
      return next
    })
  }, [pipelineMode, groupedSections, serverActivosListMode])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const stagesData = await pipelineApi.getStages()
      setStages(stagesData)
      const [activosTotalCount, archTotalCount] = await Promise.all([
        pipelineApi.getActiveLeadsTotalCount(),
        pipelineApi.getArchivedLeadsTotalCount(),
      ])
      onCountsChange?.({ activos: activosTotalCount, archivados: archTotalCount })

      if (pipelineMode === 'archivados') {
        const { leads: archPage, total } = await pipelineApi.queryArchivedLeadsPage({
          offset: 0,
          limit: PIPELINE_STAGE_PAGE_SIZE,
        })
        setLeads(archPage)
        setArchivedTotal(total)
      } else if (activosLeads == null) {
        const idsIn =
          weeklyMode && weeklyFilterLeadIds && weeklyFilterLeadIds.size > 0
            ? [...weeklyFilterLeadIds]
            : null
        const { leads: page, total } = await pipelineApi.queryActivosLeads({
          offset: 0,
          limit: PIPELINE_STAGE_PAGE_SIZE,
          search: debouncedSearch || undefined,
          source: sourceFilter.trim() || undefined,
          temperature: temperatureFilter.trim() || undefined,
          idsIn,
        })
        setServerActivosLeads(page)
        setServerActivosTotal(total)
        setActivosListLoadedCount(page.length)
        setLeads([])
      } else {
        setServerActivosLeads([])
        setServerActivosTotal(0)
        setActivosListLoadedCount(0)
        const arch = await pipelineApi.queryArchivedLeadsPage({
          offset: 0,
          limit: PIPELINE_STAGE_PAGE_SIZE,
        })
        setLeads(arch.leads)
        setArchivedTotal(arch.total)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pipelineMode / origen activos
  }, [pipelineMode, activosLeads])

  useEffect(() => {
    if (pipelineMode !== 'activos' || activosLeads != null) return
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filtros servidor
  }, [debouncedSearch, sourceFilter, temperatureFilter, weeklyIdsKey])

  const refreshCurrentMode = async () => {
    if (pipelineMode === 'activos' && onRefreshActivos) {
      await onRefreshActivos()
    }
    if (pipelineMode === 'archivados' || (pipelineMode === 'activos' && activosLeads == null)) {
      await loadData()
    }
  }

  const loadMoreActivos = async () => {
    if (activosListLoadedCount >= serverActivosTotal) return
    setListLoadingMore(true)
    try {
      const idsIn =
        weeklyMode && weeklyFilterLeadIds && weeklyFilterLeadIds.size > 0
          ? [...weeklyFilterLeadIds]
          : null
      const { leads: page } = await pipelineApi.queryActivosLeads({
        offset: activosListLoadedCount,
        limit: PIPELINE_STAGE_PAGE_SIZE,
        search: debouncedSearch || undefined,
        source: sourceFilter.trim() || undefined,
        temperature: temperatureFilter.trim() || undefined,
        idsIn,
      })
      if (page.length === 0) return
      setServerActivosLeads((prev) => [...prev, ...page])
      setActivosListLoadedCount((c) => c + page.length)
    } finally {
      setListLoadingMore(false)
    }
  }

  const loadMoreArchived = async () => {
    if (leads.length >= archivedTotal) return
    setListLoadingMore(true)
    try {
      const { leads: page } = await pipelineApi.queryArchivedLeadsPage({
        offset: leads.length,
        limit: PIPELINE_STAGE_PAGE_SIZE,
      })
      if (page.length === 0) return
      setLeads((prev) => [...prev, ...page])
    } finally {
      setListLoadingMore(false)
    }
  }

  const clearCalModal = useCallback(() => {
    setCalModal(null)
  }, [])

  const leadsForSchedule = useMemo(() => {
    if (pipelineMode === 'archivados') return sortedLeads
    const m = new Map<string, Lead>()
    for (const l of serverActivosLeads) m.set(l.id, l)
    for (const l of sortedLeads) m.set(l.id, l)
    return [...m.values()]
  }, [pipelineMode, sortedLeads, serverActivosLeads])

  const openScheduleForLead = useCallback(
    async (leadId: string) => {
      const r = await resolveCalModalFromGuidance(leadId, {
        leads: leadsForSchedule,
        stages,
        nextAppointmentByLeadId: mergedNextAppointmentByLeadId,
        schedulingSummaryByLeadId: mergedSchedulingSummaryByLeadId,
      })
      if (r.kind === 'toast') {
        setToast({
          type: r.level === 'error' ? 'error' : 'success',
          message: r.message,
        })
        return
      }
      if (r.kind === 'edit') {
        setCalModal({
          mode: 'edit',
          leadId: r.leadId,
          event: r.event,
          helpText: r.helpText,
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
    [leadsForSchedule, stages, mergedNextAppointmentByLeadId, mergedSchedulingSummaryByLeadId]
  )

  useEffect(() => {
    return subscribeGoogleCalendarSyncErrors((msg) => {
      setToast({ type: 'error', message: msg })
    })
  }, [])

  const handleLeadCreatedForCalendar = useCallback((lead: Lead) => {
    setPostCreateAskLead(lead)
  }, [])

  const handleCreateLead = async (data: CreateLeadInput) => {
    const newLead = await pipelineApi.createLead(data)
    setCollapsedStages((prev) => ({ ...prev, [newLead.stage_id]: false }))
    setHighlightLeadId(newLead.id)
    setTimeout(() => setHighlightLeadId(null), 3000)
    await refreshCurrentMode()
    setToast({ type: 'success', message: 'Lead creado' })
    return newLead
  }

  const handleRowClick = useCallback(
    (l: Lead) => navigate(`/leads/${l.id}`),
    [navigate]
  )

  const executeMoveStage = async (leadId: string, fromStageId: string, toStageId: string) => {
    const lead = baseLeads.find((l) => l.id === leadId)
    const prevStageChangedAt = lead?.stage_changed_at ?? null
    const idempotencyKey = generateIdempotencyKey(leadId, fromStageId, toStageId)

    onMoveStageOptimistic?.(leadId, fromStageId, toStageId, prevStageChangedAt)
    setCollapsedStages((prev) => ({ ...prev, [toStageId]: false }))
    setHighlightLeadId(leadId)
    const highlightTimeout = setTimeout(() => setHighlightLeadId(null), 2500)

    try {
      await pipelineApi.moveLeadStage(leadId, toStageId, idempotencyKey)
      await refreshCurrentMode()
      setToast({ type: 'success', message: 'Etapa actualizada' })
    } catch (err) {
      clearTimeout(highlightTimeout)
      setHighlightLeadId(null)
      onMoveStageRollback?.(leadId, fromStageId, prevStageChangedAt ?? null)
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Error al mover' })
    }
  }

  const handleMoveStage = async (leadId: string, toStageId: string) => {
    const lead = baseLeads.find((l) => l.id === leadId)
    if (!lead || lead.stage_id === toStageId) return
    const fromStageId = lead.stage_id

    if (lead.next_action_at == null) {
      setPendingMoveStage({ leadId, fromStageId, toStageId })
      return
    }

    await executeMoveStage(leadId, fromStageId, toStageId)
  }

  if (loading) {
    return (
      <div className="text-center p-8">
        <span className="text-muted">Cargando...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-4 bg-red-50 border border-red-200">
        <p className="text-sm text-red-700 mb-3">{error}</p>
        <button onClick={() => loadData()} className="btn btn-primary text-sm">
          Reintentar
        </button>
      </div>
    )
  }

  if (weeklyMode && filteredLeads.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 dark:bg-neutral-800/40 p-8 text-center">
        <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
          No hubo entradas a esta etapa en la semana seleccionada.
        </p>
        {onClearWeekly && (
          <button
            type="button"
            onClick={onClearWeekly}
            className="text-sm text-neutral-600 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-black/5 px-2 py-1 rounded transition-colors"
          >
            Quitar filtro
          </button>
        )}
      </div>
    )
  }

  /** Modo servidor (Registros): búsqueda/fuente/temperatura ya aplicados en la query. */
  const hasActiveServerFilters =
    activosLeads == null &&
    (debouncedSearch.trim() !== '' ||
      sourceFilter.trim() !== '' ||
      temperatureFilter.trim() !== '')

  const showActivosTrulyEmpty =
    pipelineMode === 'activos' &&
    activosLeads == null &&
    serverActivosTotal === 0 &&
    serverActivosLeads.length === 0 &&
    !loading &&
    !hasActiveServerFilters

  const showActivosEmptyState =
    pipelineMode === 'activos' &&
    (activosLeads == null ? showActivosTrulyEmpty : baseLeads.length === 0)
  if (showActivosEmptyState) {
    return (
      <div className="space-y-4">
        <div className="card text-center p-12">
          <p className="mb-4 text-base">Aún no hay leads en el pipeline.</p>
          <p className="text-muted mb-6">Crea tu primer lead para comenzar.</p>
          <button onClick={() => setIsCreateModalOpen(true)} className={BTN_PRIMARY}>
            <span className="md:hidden">Nuevo</span>
            <span className="hidden md:inline">+ Nuevo lead</span>
          </button>
        </div>
        <LeadCreateModal
          stages={stages}
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreateLead}
          onLeadCreated={handleLeadCreatedForCalendar}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="md:sticky md:top-0 z-20 border-b border-neutral-200/70 md:pb-4 md:pt-1 supports-[backdrop-filter]:backdrop-blur-sm supports-[backdrop-filter]:bg-white/50">
        {/* FILA 3: Search, Source, Temperatura */}
        <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:gap-3 md:items-center pt-1">
          <input
            type="search"
            placeholder="Buscar nombre, teléfono o email…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-w-0 h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-300 focus:ring-offset-1 md:flex-1 md:min-w-[200px]"
            aria-label="Buscar leads"
          />
          <div className="flex items-center gap-2 min-w-0 flex-1 md:flex-initial md:flex-none flex-wrap">
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="flex-1 min-w-0 h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 focus:border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-300 focus:ring-offset-1 md:w-[180px] md:flex-none"
              aria-label="Filtrar por fuente"
            >
              <option value="">Todas</option>
              <option value="Referido">Referido</option>
              <option value="Mercado natural">Mercado natural</option>
              <option value="Frío">Frío</option>
              <option value="Social media">Social media</option>
            </select>
            {sourceFilter.trim() !== '' && (
              <span className="hidden md:inline-flex items-center gap-1.5 h-9 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-700 flex-shrink-0">
                Fuente: <span className="font-medium">{sourceFilter.trim()}</span>
                <button
                  type="button"
                  onClick={() => setSourceFilter('')}
                  className="rounded-lg p-0.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
                  aria-label="Quitar filtro de fuente"
                >
                  ×
                </button>
              </span>
            )}
            <select
              value={temperatureFilter}
              onChange={(e) => setTemperatureFilter(e.target.value)}
              className="flex-1 min-w-0 h-9 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-700 focus:border-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-300 focus:ring-offset-1 md:w-[200px] md:flex-none"
              aria-label="Filtrar por temperatura de interés"
            >
              <option value="">Todas las temperaturas</option>
              <option value="__null__">Sin clasificar</option>
              <option value="frio">Frío</option>
              <option value="tibio">Tibio</option>
              <option value="caliente">Caliente</option>
            </select>
            {temperatureFilter.trim() !== '' && (
              <span className="hidden md:inline-flex items-center gap-1.5 h-9 rounded-xl border border-neutral-200 bg-neutral-50 px-3 text-sm text-neutral-700 flex-shrink-0">
                Temperatura:{' '}
                <span className="font-medium">
                  {temperatureFilter === '__null__'
                    ? 'Sin clasificar'
                    : temperatureFilter === 'frio'
                      ? 'Frío'
                      : temperatureFilter === 'tibio'
                        ? 'Tibio'
                        : temperatureFilter === 'caliente'
                          ? 'Caliente'
                          : temperatureFilter}
                </span>
                <button
                  type="button"
                  onClick={() => setTemperatureFilter('')}
                  className="rounded-lg p-0.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
                  aria-label="Quitar filtro de temperatura"
                >
                  ×
                </button>
              </span>
            )}
            {pipelineMode === 'activos' && (
              <button onClick={() => setIsCreateModalOpen(true)} className={BTN_PRIMARY}>
                <span className="md:hidden">Nuevo</span>
                <span className="hidden md:inline">+ Nuevo lead</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {pipelineMode === 'activos' &&
        activosLeads == null &&
        hasActiveServerFilters &&
        serverActivosTotal === 0 &&
        serverActivosLeads.length === 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-neutral-800">
            <p className="mb-2">No hay leads que coincidan con los filtros actuales.</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setSourceFilter('')
                setTemperatureFilter('')
              }}
              className="text-sm font-medium text-neutral-900 underline-offset-2 hover:underline"
            >
              Quitar todos los filtros
            </button>
          </div>
        )}

      {pipelineMode === 'archivados' ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2 pr-4 font-medium">Lead</th>
                <th className="py-2 pr-4 font-medium">Etapa</th>
                <th className="py-2 pr-4 font-medium">Fuente</th>
                <th className="py-2 pr-4 font-medium">Temperatura</th>
                <th className="py-2 pr-4 font-medium">Archivado el</th>
                <th className="py-2 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted">
                    No hay leads archivados.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const stage = stages.find((s) => s.id === lead.stage_id)
                  const stageName = stage?.name
                  const stageSlug = stage?.slug
                  const isArchived = lead.archived_at != null
                  return (
                    <tr
                      key={lead.id}
                      className="border-b border-border/60 hover:bg-black/[0.02]"
                      style={getStageAccentStyle(stageSlug)}
                    >
                      <td className="py-2.5 pr-4">
                        <button
                          type="button"
                          onClick={() => navigate(`/leads/${lead.id}`)}
                          className="font-medium text-left hover:underline"
                        >
                          {lead.full_name}
                        </button>
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={getStageTagClasses(stageSlug)}>{displayStageName(stageName)}</span>
                      </td>
                      <td className="py-2.5 pr-4 align-middle">
                        <LeadSourceTag source={lead.source} />
                      </td>
                      <td className="py-2.5 pr-4 text-muted">
                        <LeadTemperatureChip temperature={lead.temperature} showPlaceholder />
                      </td>
                      <td className="py-2.5 pr-4 text-muted tabular-nums">
                        {isArchived ? formatDateMX(lead.archived_at) : '—'}
                      </td>
                      <td className="py-2.5">
                        {isArchived ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              const hasNextAction =
                                lead.next_action_at != null && lead.next_action_at.trim() !== ''
                              if (hasNextAction) {
                                pipelineApi
                                  .updateLead(lead.id, {
                                    archived_at: null,
                                    archived_by: null,
                                    archive_reason: null,
                                  })
                                  .then(async () => {
                                    await loadData()
                                    await onRefreshActivos?.()
                                    setToast({ type: 'success', message: 'Restaurado. Ya aparece en Activos.' })
                                  })
                                  .catch((err) => {
                                    console.error('Error al restaurar lead:', err)
                                    const msg =
                                      err instanceof Error &&
                                      (err.message.includes('23514') ||
                                        err.message.includes('Próxima Acción'))
                                        ? 'Para restaurar este lead necesitas definir un Próximo paso.'
                                        : err instanceof Error
                                          ? err.message
                                          : 'Error al restaurar'
                                    setToast({ type: 'error', message: msg })
                                  })
                              } else {
                                setRestoreLeadPending(lead)
                              }
                            }}
                            className="btn btn-ghost text-xs"
                          >
                            Restaurar
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
          {leads.length < archivedTotal ? (
            <div className="flex justify-center py-3">
              <button
                type="button"
                onClick={() => void loadMoreArchived()}
                disabled={listLoadingMore}
                className="rounded-lg border border-dashed border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
              >
                {listLoadingMore ? 'Cargando…' : `Cargar más (${leads.length} de ${archivedTotal})`}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
            <PipelineTable
              leads={sortedLeads}
              stages={stagesLite}
              groupedSections={groupByStage ? sectionsToRender : undefined}
              groupByStage={groupByStage}
              defaultCollapseEmptyStages={!serverActivosListMode}
              collapsedStages={collapsedStages}
              onCollapsedStagesChange={setCollapsedStages}
              highlightLeadId={highlightLeadId}
              onRowClick={handleRowClick}
              onMoveStage={handleMoveStage}
              onToast={onToast ?? ((msg) => setToast({ type: 'success', message: msg }))}
              onUpdated={refreshCurrentMode}
              nextAppointmentByLeadId={mergedNextAppointmentByLeadId}
              onSchedule={openScheduleForLead}
              schedulingGuidanceByLeadId={schedulingGuidanceByLeadId}
            />
            {serverActivosListMode && activosListLoadedCount < serverActivosTotal ? (
              <div className="flex justify-center py-2">
                <button
                  type="button"
                  onClick={() => void loadMoreActivos()}
                  disabled={listLoadingMore}
                  className="rounded-lg border border-dashed border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
                >
                  {listLoadingMore
                    ? 'Cargando…'
                    : `Cargar más (${activosListLoadedCount} de ${serverActivosTotal})`}
                </button>
              </div>
            ) : null}
        </div>
      )}

      <LeadCreateModal
        stages={stages}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateLead}
        onLeadCreated={handleLeadCreatedForCalendar}
      />

      <PostCreateCalendarAskDialog
        isOpen={postCreateAskLead != null}
        onSelect={(type) => {
          const lead = postCreateAskLead
          if (!lead) return
          setCalModal({
            mode: 'create',
            leadId: lead.id,
            initialAppointmentType: type,
            lockType: type,
            helpText: null,
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
            void refreshCurrentMode()
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
          key={`edit-${calModal.event.id}`}
          isOpen
          onClose={clearCalModal}
          mode="edit"
          event={calModal.event}
          onSaved={() => {
            void refreshCurrentMode()
          }}
          helpText={calModal.helpText ?? null}
        />
      )}

      <NextActionModal
        isOpen={pendingMoveStage != null}
        onClose={() => setPendingMoveStage(null)}
        onSave={async (next_action_at, next_action_type) => {
          const pending = pendingMoveStage
          if (!pending) return
          try {
            await pipelineApi.updateLead(pending.leadId, { next_action_at, next_action_type })
          } catch (err) {
            setToast({ type: 'error', message: err instanceof Error ? err.message : 'Error al guardar próxima acción' })
            throw err
          }
          setPendingMoveStage(null)
          await executeMoveStage(pending.leadId, pending.fromStageId, pending.toStageId)
        }}
        title="Define el próximo paso para mover"
        allowNoDate={false}
      />

      <NextActionModal
        isOpen={restoreLeadPending != null}
        onClose={() => setRestoreLeadPending(null)}
        onSave={async (next_action_at, next_action_type) => {
          const lead = restoreLeadPending
          if (!lead) return
          try {
            await pipelineApi.updateLead(lead.id, {
              next_action_at,
              next_action_type,
              archived_at: null,
              archived_by: null,
              archive_reason: null,
            })
            setRestoreLeadPending(null)
            await loadData()
            await onRefreshActivos?.()
            setToast({ type: 'success', message: 'Restaurado. Ya aparece en Activos.' })
          } catch (err) {
            console.error('Error al restaurar lead (NextActionModal):', err)
            const msg = err instanceof Error ? err.message : 'Error al restaurar'
            setToast({ type: 'error', message: msg })
            throw err
          }
        }}
        title="Define el próximo paso para restaurar"
        initialNextActionAt={restoreLeadPending?.next_action_at}
        initialNextActionType={restoreLeadPending?.next_action_type}
        allowNoDate={false}
      />

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          durationMs={1200}
        />
      )}
    </div>
  )
}
