import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { pipelineApi, type Lead } from '../features/pipeline/pipeline.api'
import { LeadCreateModal } from '../features/pipeline/components/LeadCreateModal'
import { Toast } from '../shared/components/Toast'
import { formatDateMX } from '../shared/utils/dates'
import { getStageTagClasses, getStageAccentStyle } from '../shared/utils/stageStyles'
import { PipelineTable } from '../features/pipeline/components/PipelineTable'
import { getProximaLabel } from '../features/pipeline/utils/proximaLabel'

type Stage = {
  id: string
  name: string
  position: number
}

// Helper: Convert Stage to PipelineStage for LeadCreateModal
function stageToPipelineStage(stage: Stage): { id: string; name: string; position: number; is_active: boolean } {
  return {
    id: stage.id,
    name: stage.name,
    position: stage.position,
    is_active: true,
  }
}

// Orden dentro de cada etapa: next_follow_up_at asc (más próximo arriba), nulls last.
// Pipeline muestra solo next_follow_up_at; no usar otras fechas para ordenar aquí.
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

export function PipelinePage() {
  const navigate = useNavigate()
  const [stages, setStages] = useState<Stage[]>([])
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

  useEffect(() => {
    loadData()
  }, [pipelineMode])

  // Inicializar collapsedStages: 0 leads → colapsado, ≥1 → expandido (solo stages no presentes en estado)
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

      setStages(stagesData.map((s) => ({
        id: s.id,
        name: s.name,
        position: s.position,
      })))
      setActivosCount(activosData.length)
      setArchivadosCount(archivadosData.length)
      setLeads(pipelineMode === 'activos' ? activosData : archivadosData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  // Handle create lead: expandir etapa destino y highlight del lead creado
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

  // Activos: todos los leads; orden por next_follow_up_at asc, nulls last
  const filteredLeads = useMemo(() => {
    if (pipelineMode !== 'activos') return []
    return leads
  }, [pipelineMode, leads])

  const sortedLeads = useMemo(
    () => sortLeadsByPriority(filteredLeads),
    [filteredLeads]
  )

  // Agrupado por etapa: orden por stages.position; dentro de cada etapa ya está orden por next_follow_up_at (sortedLeads)
  const groupedSections = useMemo(() => {
    if (pipelineMode !== 'activos') return []
    return stages.map((stage) => ({
      stage,
      leads: sortedLeads.filter((l) => l.stage_id === stage.id),
    }))
  }, [pipelineMode, stages, sortedLeads])

  // Secciones a renderizar: con hideEmptyStages ON no se muestran etapas con 0 leads
  const sectionsToRender = useMemo(() => {
    if (!groupByStage || pipelineMode !== 'activos') return []
    return hideEmptyStages ? groupedSections.filter((s) => s.leads.length > 0) : groupedSections
  }, [groupByStage, pipelineMode, hideEmptyStages, groupedSections])

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

  if (loading) {
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

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">Pipeline</h1>
            <p className="text-sm text-muted">Seguimiento de tus oportunidades activas</p>
          </div>
        </div>
        <div className="card p-4 bg-red-50 border border-red-200">
          <p className="text-sm text-red-700 mb-3">{error}</p>
          <button onClick={() => loadData()} className="btn btn-primary text-sm">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (pipelineMode === 'activos' && leads.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold mb-1">Pipeline</h1>
            <p className="text-sm text-muted">Seguimiento de tus oportunidades activas</p>
          </div>
          <div className="flex gap-2 items-center">
            <div className="inline-flex rounded-lg border border-border bg-neutral-100/80 p-0.5 gap-0.5" role="tablist" aria-label="Vista del pipeline">
              <button role="tab" aria-selected={true} onClick={() => setPipelineMode('activos')} className="px-3 py-1.5 text-sm rounded-md inline-flex items-center gap-1.5 bg-white text-neutral-900 ring-1 ring-neutral-200 font-medium">
                Activos <span className="rounded-full text-xs px-2 py-0.5 bg-neutral-200 text-neutral-700 ring-1 ring-neutral-300 tabular-nums">{activosCount}</span>
              </button>
              <button role="tab" aria-selected={false} onClick={() => setPipelineMode('archivados')} className="px-3 py-1.5 text-sm rounded-md inline-flex items-center gap-1.5 bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-200/60">
                Archivados <span className="rounded-full text-xs px-2 py-0.5 bg-neutral-200 text-neutral-700 ring-1 ring-neutral-300 tabular-nums">{archivadosCount}</span>
              </button>
            </div>
            <button onClick={() => setIsCreateModalOpen(true)} className="btn btn-primary text-sm">+ Nuevo lead</button>
          </div>
        </div>
        <div className="card text-center p-12">
          <p className="mb-4 text-base">Aún no hay leads en el pipeline.</p>
          <p className="text-muted mb-6">Crea tu primer lead para comenzar.</p>
          <button onClick={() => setIsCreateModalOpen(true)} className="btn btn-primary">+ Nuevo lead</button>
        </div>
        <LeadCreateModal stages={stages.map(stageToPipelineStage)} isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSubmit={handleCreateLead} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold mb-1">Pipeline</h1>
          <p className="text-sm text-muted">Seguimiento de tus oportunidades activas</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <div
            className="inline-flex rounded-lg border border-border bg-neutral-100/80 p-0.5 gap-0.5"
            role="tablist"
            aria-label="Vista del pipeline"
          >
            <button
              role="tab"
              aria-selected={pipelineMode === 'activos'}
              onClick={() => setPipelineMode('activos')}
              className={`px-3 py-1.5 text-sm rounded-md inline-flex items-center gap-1.5 ${
                pipelineMode === 'activos' ? 'bg-white text-neutral-900 ring-1 ring-neutral-200 font-medium' : 'bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-200/60'
              }`}
            >
              Activos
              <span className="rounded-full text-xs px-2 py-0.5 bg-neutral-200 text-neutral-700 ring-1 ring-neutral-300 tabular-nums">
                {activosCount}
              </span>
            </button>
            <button
              role="tab"
              aria-selected={pipelineMode === 'archivados'}
              onClick={() => setPipelineMode('archivados')}
              className={`px-3 py-1.5 text-sm rounded-md inline-flex items-center gap-1.5 ${
                pipelineMode === 'archivados' ? 'bg-white text-neutral-900 ring-1 ring-neutral-200 font-medium' : 'bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-200/60'
              }`}
            >
              Archivados
              <span className="rounded-full text-xs px-2 py-0.5 bg-neutral-200 text-neutral-700 ring-1 ring-neutral-300 tabular-nums">
                {archivadosCount}
              </span>
            </button>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn btn-primary text-sm"
          >
            + Nuevo lead
          </button>
        </div>
      </div>

      {/* Contenido según modo */}
      {pipelineMode === 'archivados' ? (
        /* Vista Archivados: solo leads con archived_at no null */
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
        <>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div
                className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100/80 p-0.5"
                role="group"
                aria-label="Vista de tabla"
              >
                <button
                  type="button"
                  onClick={() => setGroupByStage(true)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    groupByStage ? 'bg-white text-neutral-900 ring-1 ring-neutral-200 font-medium' : 'text-neutral-600 hover:bg-neutral-200/60'
                  }`}
                >
                  Agrupar por etapa
                </button>
                <button
                  type="button"
                  onClick={() => setGroupByStage(false)}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    !groupByStage ? 'bg-white text-neutral-900 ring-1 ring-neutral-200 font-medium' : 'text-neutral-600 hover:bg-neutral-200/60'
                  }`}
                >
                  Vista plana
                </button>
              </div>
              {groupByStage && sectionsToRender.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={collapseAllStages}
                    className="btn btn-ghost text-sm"
                  >
                    Colapsar todo
                  </button>
                  <button
                    type="button"
                    onClick={expandAllStages}
                    className="btn btn-ghost text-sm"
                  >
                    Expandir todo
                  </button>
                </>
              )}
              {groupByStage && (
                <label className="inline-flex items-center gap-2 text-sm text-neutral-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hideEmptyStages}
                    onChange={(e) => setHideEmptyStages(e.target.checked)}
                    className="rounded border-neutral-300"
                  />
                  Ocultar etapas vacías
                </label>
              )}
            </div>
            <PipelineTable
              leads={sortedLeads}
              stages={stages}
              groupedSections={groupByStage ? sectionsToRender : undefined}
              groupByStage={groupByStage}
              collapsedStages={collapsedStages}
              onCollapsedStagesChange={setCollapsedStages}
              highlightLeadId={highlightLeadId}
              getProximaLabel={getProximaLabel}
              onRowClick={(l) => navigate(`/leads/${l.id}`)}
            />
          </div>
        </>
      )}

      {/* Create Lead Modal */}
      <LeadCreateModal
        stages={stages.map(stageToPipelineStage)}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateLead}
      />

      {/* Toast - minimal feedback */}
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
