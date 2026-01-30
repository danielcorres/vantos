import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { pipelineApi, type Lead, type PipelineStage } from '../pipeline.api'
import { generateIdempotencyKey } from '../pipeline.store'
import { LeadCreateModal } from '../components/LeadCreateModal'
import { PipelineTable } from '../components/PipelineTable'
import { getProximaLabel } from '../utils/proximaLabel'
import { Toast } from '../../../shared/components/Toast'
import { formatDateMX } from '../../../shared/utils/dates'
import { getStageTagClasses, getStageAccentStyle } from '../../../shared/utils/stageStyles'

// Mismo skin que Tabla/Kanban/Insights en PipelinePage: chips/tabs neutros
const CHIP_WRAPPER = 'inline-flex rounded-lg border border-neutral-200 bg-neutral-100/80 p-0.5 gap-0.5'
const CHIP_ACTIVE = 'px-3 py-1.5 text-sm rounded-md transition-colors inline-flex items-center gap-1.5 bg-white text-neutral-900 ring-1 ring-neutral-200 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200 focus-visible:ring-offset-1'
const CHIP_INACTIVE = 'px-3 py-1.5 text-sm rounded-md transition-colors inline-flex items-center gap-1.5 text-neutral-600 hover:bg-neutral-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200 focus-visible:ring-offset-1'
const CHIP_BADGE = 'rounded-full text-[10px] px-1.5 py-0.5 bg-neutral-100 text-neutral-500 tabular-nums'

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
  weeklyFilterLeadIds = null,
  weeklyLoadError = null,
  onClearWeekly,
  onVisibleCountChange,
}: {
  weeklyFilterLeadIds?: Set<string> | null
  weeklyStageLabel?: string | null
  weeklyWeekRange?: string | null
  weeklyLoadError?: string | null
  onClearWeekly?: () => void
  /** Cantidad visible tras filtros (weekly + búsqueda + fuente) para "Mostrando N" en banner. */
  onVisibleCountChange?: (n: number) => void
} = {}) {
  const navigate = useNavigate()
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [pipelineMode, setPipelineMode] = useState<'activos' | 'archivados'>('activos')
  const [activosCount, setActivosCount] = useState(0)
  const [archivadosCount, setArchivadosCount] = useState(0)
  const [groupByStage, setGroupByStage] = useState(true)
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({})
  const [highlightLeadId, setHighlightLeadId] = useState<string | null>(null)
  const [hideEmptyStages, setHideEmptyStages] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')

  const weeklyMode = weeklyFilterLeadIds != null && weeklyLoadError == null

  const filteredLeads = useMemo(() => {
    if (pipelineMode !== 'activos') return []
    let list = leads
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
    return list
  }, [pipelineMode, leads, searchQuery, sourceFilter, weeklyMode, weeklyFilterLeadIds])

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
      stage: { id: stage.id, name: stage.name, position: stage.position },
      leads: sortedLeads.filter((l) => l.stage_id === stage.id),
    }))
  }, [pipelineMode, stages, sortedLeads])

  const sectionsToRender = useMemo(() => {
    if (!groupByStage || pipelineMode !== 'activos') return []
    return hideEmptyStages ? groupedSections.filter((s) => s.leads.length > 0) : groupedSections
  }, [groupByStage, pipelineMode, hideEmptyStages, groupedSections])

  useEffect(() => {
    loadData()
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
      setActivosCount(activosData.length)
      setArchivadosCount(archivadosData.length)
      setLeads(pipelineMode === 'activos' ? activosData : archivadosData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateLead = async (data: {
    full_name: string
    phone?: string
    email?: string
    source?: string
    notes?: string
    stage_id: string
    next_follow_up_at?: string
  }) => {
    const newLead = await pipelineApi.createLead(data)
    setIsCreateModalOpen(false)
    setCollapsedStages((prev) => ({ ...prev, [newLead.stage_id]: false }))
    setHighlightLeadId(newLead.id)
    setTimeout(() => setHighlightLeadId(null), 3000)
    await loadData()
    setToast({ type: 'success', message: 'Lead creado' })
  }

  const collapseAllStages = () => {
    setCollapsedStages((prev) => {
      const next = { ...prev }
      groupedSections.forEach(({ stage }) => { next[stage.id] = true })
      return next
    })
  }
  const expandAllStages = () => {
    setCollapsedStages((prev) => {
      const next = { ...prev }
      groupedSections.forEach(({ stage }) => { next[stage.id] = false })
      return next
    })
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

  if (pipelineMode === 'activos' && leads.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className={CHIP_WRAPPER} role="tablist" aria-label="Modo del pipeline">
            <button role="tab" aria-selected={true} onClick={() => setPipelineMode('activos')} className={CHIP_ACTIVE}>
              Activos <span className={CHIP_BADGE}>{activosCount}</span>
            </button>
            <button role="tab" aria-selected={false} onClick={() => setPipelineMode('archivados')} className={CHIP_INACTIVE}>
              Archivados <span className={CHIP_BADGE}>{archivadosCount}</span>
            </button>
          </div>
          <button onClick={() => setIsCreateModalOpen(true)} className="btn btn-primary text-sm">+ Nuevo lead</button>
        </div>
        <div className="card text-center p-12">
          <p className="mb-4 text-base">Aún no hay leads en el pipeline.</p>
          <p className="text-muted mb-6">Crea tu primer lead para comenzar.</p>
          <button onClick={() => setIsCreateModalOpen(true)} className="btn btn-primary">+ Nuevo lead</button>
        </div>
        <LeadCreateModal stages={stages} isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSubmit={handleCreateLead} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="md:sticky md:top-0 z-20 border-b border-neutral-200/70 md:pb-4 md:pt-1 supports-[backdrop-filter]:backdrop-blur-sm supports-[backdrop-filter]:bg-white/50">
        <div className="flex flex-col gap-3 pt-1">
          {/* Fila 1 (primary): búsqueda + fuente + chip opcional + Nuevo lead alineado a la derecha */}
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <input
              type="search"
              placeholder="Buscar nombre, teléfono o email…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-w-[240px] flex-1 w-full max-w-full rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-200"
              aria-label="Buscar leads"
            />
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="w-[180px] md:w-[220px] flex-shrink-0 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-700 focus:border-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-200"
              aria-label="Filtrar por fuente"
            >
              <option value="">Todas</option>
              <option value="Referido">Referido</option>
              <option value="Mercado natural">Mercado natural</option>
              <option value="Frío">Frío</option>
              <option value="Social media">Social media</option>
            </select>
            {sourceFilter.trim() !== '' && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-sm text-neutral-700 flex-shrink-0">
                Fuente: <span className="font-medium">{sourceFilter.trim()}</span>
                <button
                  type="button"
                  onClick={() => setSourceFilter('')}
                  className="rounded p-0.5 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800 transition-colors"
                  aria-label="Quitar filtro de fuente"
                >
                  ×
                </button>
              </span>
            )}
            {pipelineMode === 'activos' && (
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="btn btn-primary text-sm flex-shrink-0 ml-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
              >
                + Nuevo lead
              </button>
            )}
          </div>

          {/* Fila 2 (secondary): chips Activos/Archivados + Agrupar/Vista plana + acciones secundarias */}
          <div className="flex flex-wrap items-center gap-2 md:gap-3">
            <div className="flex flex-wrap items-center gap-2 md:gap-3 flex-shrink-0 min-w-0" role="group" aria-label="Estado y vista">
              <div className={`${CHIP_WRAPPER} flex-shrink-0`} role="tablist" aria-label="Modo del pipeline">
                <button
                  role="tab"
                  aria-selected={pipelineMode === 'activos'}
                  onClick={() => setPipelineMode('activos')}
                  className={pipelineMode === 'activos' ? CHIP_ACTIVE : CHIP_INACTIVE}
                >
                  Activos
                  <span className={CHIP_BADGE}>{activosCount}</span>
                </button>
                <button
                  role="tab"
                  aria-selected={pipelineMode === 'archivados'}
                  onClick={() => setPipelineMode('archivados')}
                  className={pipelineMode === 'archivados' ? CHIP_ACTIVE : CHIP_INACTIVE}
                >
                  Archivados
                  <span className={CHIP_BADGE}>{archivadosCount}</span>
                </button>
              </div>
              {pipelineMode === 'activos' && (
                <div className={`${CHIP_WRAPPER} flex-shrink-0`} role="group" aria-label="Vista de tabla">
                  <button
                    type="button"
                    aria-pressed={groupByStage}
                    onClick={() => setGroupByStage(true)}
                    className={groupByStage ? CHIP_ACTIVE : CHIP_INACTIVE}
                  >
                    Agrupar por etapa
                  </button>
                  <button
                    type="button"
                    aria-pressed={!groupByStage}
                    onClick={() => setGroupByStage(false)}
                    className={!groupByStage ? CHIP_ACTIVE : CHIP_INACTIVE}
                  >
                    Vista plana
                  </button>
                </div>
              )}
            </div>
            {groupByStage && pipelineMode === 'activos' && (
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Acciones">
                <button
                  type="button"
                  onClick={collapseAllStages}
                  className="text-sm text-neutral-600 hover:text-neutral-900 py-1.5 px-2.5 rounded-md hover:bg-neutral-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200 focus-visible:ring-offset-1"
                >
                  Colapsar
                </button>
                <button
                  type="button"
                  onClick={expandAllStages}
                  className="text-sm text-neutral-600 hover:text-neutral-900 py-1.5 px-2.5 rounded-md hover:bg-neutral-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200 focus-visible:ring-offset-1"
                >
                  Expandir
                </button>
                <button
                  type="button"
                  role="button"
                  aria-pressed={hideEmptyStages}
                  onClick={() => setHideEmptyStages((prev) => !prev)}
                  className={`text-sm py-1.5 px-2.5 rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200 focus-visible:ring-offset-1 ${
                    hideEmptyStages
                      ? 'border-neutral-300 bg-neutral-100 text-neutral-900'
                      : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  Ocultar vacías{hideEmptyStages ? ' ✓' : ''}
                </button>
              </div>
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
                  const stageName = stages.find((s) => s.id === lead.stage_id)?.name
                  const isArchived = lead.archived_at != null
                  return (
                    <tr
                      key={lead.id}
                      className="border-b border-border/60 hover:bg-black/[0.02]"
                      style={getStageAccentStyle(stageName)}
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
                        <span className={getStageTagClasses(stageName)}>{stageName ?? '—'}</span>
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
              getProximaLabel={getProximaLabel}
              onRowClick={(l) => navigate(`/leads/${l.id}`)}
              onMoveStage={handleMoveStage}
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
