import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { pipelineApi, type Lead, type PipelineStage, type CreateLeadInput } from '../pipeline.api'
import { generateIdempotencyKey } from '../pipeline.store'
import { LeadCreateModal } from '../components/LeadCreateModal'
import { PipelineTable } from '../components/PipelineTable'
import { Toast } from '../../../shared/components/Toast'
import { formatDateMX } from '../../../shared/utils/dates'
import { getStageTagClasses, getStageAccentStyle, displayStageName } from '../../../shared/utils/stageStyles'

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
  pipelineMode = 'activos',
  groupByStage = true,
  onCountsChange,
  weeklyFilterLeadIds = null,
  weeklyLoadError = null,
  onClearWeekly,
  onVisibleCountChange,
  onToast,
}: {
  activosLeads?: Lead[] | null
  pipelineMode?: 'activos' | 'archivados'
  groupByStage?: boolean
  onCountsChange?: (counts: { activos: number; archivados: number }) => void
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
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({})
  const [highlightLeadId, setHighlightLeadId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')

  const weeklyMode = weeklyFilterLeadIds != null && weeklyLoadError == null

  const filteredLeads = useMemo(() => {
    if (pipelineMode !== 'activos') return []
    let list: Lead[]
    if (activosLeads != null) {
      list = activosLeads
    } else {
      list = leads
      if (weeklyMode && weeklyFilterLeadIds?.size) {
        list = list.filter((l) => weeklyFilterLeadIds.has(l.id))
      }
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
    return list
  }, [pipelineMode, activosLeads, leads, searchQuery, sourceFilter, weeklyMode, weeklyFilterLeadIds])

  useEffect(() => {
    onVisibleCountChange?.(filteredLeads.length)
  }, [filteredLeads.length, onVisibleCountChange])

  const sortedLeads = useMemo(
    () => sortLeadsByPriority(filteredLeads),
    [filteredLeads]
  )

  const groupedSections = useMemo(() => {
    if (pipelineMode !== 'activos') return []
    return stages.map((stage) => ({
      stage: { id: stage.id, name: stage.name, position: stage.position, slug: stage.slug },
      leads: sortedLeads.filter((l) => l.stage_id === stage.id),
    }))
  }, [pipelineMode, stages, sortedLeads])

  const sectionsToRender = useMemo(() => {
    if (!groupByStage || pipelineMode !== 'activos') return []
    return groupedSections
  }, [groupByStage, pipelineMode, groupedSections])

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run only when pipelineMode changes
  }, [pipelineMode])

  useEffect(() => {
    if (pipelineMode !== 'activos' || !groupedSections.length) return
    setCollapsedStages((prev) => {
      let next = prev
      for (const { stage, leads: sectionLeads } of groupedSections) {
        if (stage.id in next) continue
        next = { ...next, [stage.id]: sectionLeads.length === 0 }
      }
      return next
    })
  }, [pipelineMode, groupedSections])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [stagesData, activosData, archivadosData] = await Promise.all([
        pipelineApi.getStages(),
        pipelineApi.getLeads('activos'),
        pipelineApi.getLeads('archivados'),
      ])
      setStages(stagesData)
      onCountsChange?.({ activos: activosData.length, archivados: archivadosData.length })
      setLeads(pipelineMode === 'activos' ? activosData : archivadosData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateLead = async (data: CreateLeadInput) => {
    const newLead = await pipelineApi.createLead(data)
    setIsCreateModalOpen(false)
    setCollapsedStages((prev) => ({ ...prev, [newLead.stage_id]: false }))
    setHighlightLeadId(newLead.id)
    setTimeout(() => setHighlightLeadId(null), 3000)
    await loadData()
    setToast({ type: 'success', message: 'Lead creado' })
  }

  const handleMoveStage = async (leadId: string, toStageId: string) => {
    const lead = leads.find((l) => l.id === leadId)
    if (!lead || lead.stage_id === toStageId) return
    const idempotencyKey = generateIdempotencyKey(leadId, lead.stage_id, toStageId)
    try {
      await pipelineApi.moveLeadStage(leadId, toStageId, idempotencyKey)
      await loadData()
      setToast({ type: 'success', message: 'Etapa actualizada' })
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Error al mover' })
    }
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

  const activosListLength = activosLeads != null ? activosLeads.length : leads.length
  const showActivosEmptyState = pipelineMode === 'activos' && activosListLength === 0 && activosLeads == null
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
        <LeadCreateModal stages={stages} isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSubmit={handleCreateLead} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="md:sticky md:top-0 z-20 border-b border-neutral-200/70 md:pb-4 md:pt-1 supports-[backdrop-filter]:backdrop-blur-sm supports-[backdrop-filter]:bg-white/50">
        {/* FILA 3: Search, Source */}
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
            {pipelineMode === 'activos' && (
              <button onClick={() => setIsCreateModalOpen(true)} className={BTN_PRIMARY}>
                <span className="md:hidden">Nuevo</span>
                <span className="hidden md:inline">+ Nuevo lead</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {pipelineMode === 'archivados' ? (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted">
                <th className="py-2 pr-4 font-medium">Lead</th>
                <th className="py-2 pr-4 font-medium">Etapa</th>
                <th className="py-2 pr-4 font-medium">Fuente</th>
                <th className="py-2 pr-4 font-medium">Archivado el</th>
                <th className="py-2 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-muted">
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
                      <td className="py-2.5 pr-4 text-muted">{lead.source ?? '—'}</td>
                      <td className="py-2.5 pr-4 text-muted tabular-nums">
                        {isArchived ? formatDateMX(lead.archived_at) : '—'}
                      </td>
                      <td className="py-2.5">
                        {isArchived ? (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation()
                              try {
                                await pipelineApi.updateLead(lead.id, {
                                  archived_at: null,
                                  archived_by: null,
                                  archive_reason: null,
                                })
                                await loadData()
                                setToast({ type: 'success', message: 'Restaurado. Ya aparece en Activos.' })
                              } catch (err) {
                                setToast({ type: 'error', message: err instanceof Error ? err.message : 'Error al restaurar' })
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
        </div>
      ) : (
        <div className="space-y-3">
            <PipelineTable
              leads={sortedLeads}
              stages={stages.map((s) => ({ id: s.id, name: s.name, position: s.position }))}
              groupedSections={groupByStage ? sectionsToRender : undefined}
              groupByStage={groupByStage}
              collapsedStages={collapsedStages}
              onCollapsedStagesChange={setCollapsedStages}
              highlightLeadId={highlightLeadId}
              onRowClick={(l) => navigate(`/leads/${l.id}`)}
              onMoveStage={handleMoveStage}
              onToast={onToast ?? ((msg) => setToast({ type: 'success', message: msg }))}
              onUpdated={loadData}
            />
        </div>
      )}

      <LeadCreateModal
        stages={stages}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateLead}
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
