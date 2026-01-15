import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { pipelineApi } from '../features/pipeline/pipeline.api'
import { generateIdempotencyKey } from '../features/pipeline/pipeline.store'
import { LeadCreateModal } from '../features/pipeline/components/LeadCreateModal'
import { Toast } from '../shared/components/Toast'

type Stage = {
  id: string
  name: string
  position: number
  sla_enabled: boolean | null
  sla_days: number | null
  sla_warn_days: number | null
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

// Board row type from get_pipeline_board() RPC
type BoardRow = {
  lead_id: string
  lead_name: string | null
  stage_id: string
  stage_name: string | null
  entered_at: string | null
  sla_enabled: boolean
  sla_days: number | null
  sla_warn_days: number | null
  sla_due_at: string | null
  sla_days_left: number | null
  sla_state: 'overdue' | 'warn' | 'ok' | null
  sla_priority: number | null
}

// Lead type for internal use (normalized from BoardRow)
type Lead = {
  id: string
  name: string
  stage_id: string
  stage_name: string | null
  entered_at: string | null
  sla_state: 'overdue' | 'warn' | 'ok' | null
  sla_due_at: string | null
  sla_days_left: number | null
  sla_priority: number | null
}

type ColumnCounts = {
  overdue: number
  warn: number
  ok: number
  none: number
  total: number
}

// Helper: Format date to human readable
function formatHumanDate(dateString: string | null | undefined): string {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const diffDays = Math.floor((today.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Hoy'
    if (diffDays === 1) return 'Ayer'
    if (diffDays > 1 && diffDays <= 7) return `Hace ${diffDays} días`
    return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit' })
  } catch {
    return ''
  }
}

// Helper: Get SLA status from lead
function getSlaState(lead: Lead): 'overdue' | 'warn' | 'ok' | null {
  return lead.sla_state || null
}

// Helper: Get SLA rank for sorting (lower = higher priority)
function getSlaRank(state: ReturnType<typeof getSlaState>): number {
  const rankMap: Record<string, number> = {
    overdue: 0,
    warn: 1,
    ok: 2,
  }
  return rankMap[state || 'none'] ?? 3
}

// Helper: Get SLA badge class
function getSlaBadgeClass(status: Lead['sla_state']): string {
  if (status === 'overdue') return 'badge badge-overdue'
  if (status === 'warn') return 'badge badge-warn'
  if (status === 'ok') return 'badge badge-ok'
  return 'badge badge-none'
}

// Helper: Get SLA badge label
function getSlaBadgeLabel(status: Lead['sla_state']): string {
  if (!status) return 'Sin SLA'
  if (status === 'overdue') return 'Vencido'
  if (status === 'warn') return 'Por vencer'
  if (status === 'ok') return 'En tiempo'
  return 'Sin SLA'
}

// Helper: Get SLA border color
function getSlaBorderClass(status: Lead['sla_state']): string {
  if (status === 'overdue') return 'border-l-[3px] border-l-danger'
  if (status === 'warn') return 'border-l-[3px] border-l-warning'
  if (status === 'ok') return 'border-l-[3px] border-l-success'
  return 'border-l-[3px] border-l-border'
}

// Helper: Aggregate counts for a column
function aggregateCounts(leads: Lead[]): ColumnCounts {
  return leads.reduce<ColumnCounts>(
    (acc, lead) => {
      const state = getSlaState(lead)
      if (state === 'overdue') acc.overdue++
      else if (state === 'warn') acc.warn++
      else if (state === 'ok') acc.ok++
      else acc.none++
      acc.total++
      return acc
    },
    { overdue: 0, warn: 0, ok: 0, none: 0, total: 0 }
  )
}

// Helper: Sort leads by SLA priority
function sortLeadsBySla(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => {
    const aState = getSlaState(a)
    const bState = getSlaState(b)
    const aRank = getSlaRank(aState)
    const bRank = getSlaRank(bState)

    if (aRank !== bRank) {
      return aRank - bRank
    }

    // Same rank: use sla_priority if available
    const aPriority = a.sla_priority ?? 9999
    const bPriority = b.sla_priority ?? 9999
    if (aPriority !== bPriority) {
      return aPriority - bPriority
    }

    // Same priority: use sla_due_at (earlier first)
    const aDueAt = a.sla_due_at
    const bDueAt = b.sla_due_at
    if (aDueAt && bDueAt) {
      return new Date(aDueAt).getTime() - new Date(bDueAt).getTime()
    }
    if (aDueAt) return -1
    if (bDueAt) return 1

    // Fallback: use entered_at
    const aEntered = a.entered_at
    const bEntered = b.entered_at
    if (aEntered && bEntered) {
      return new Date(aEntered).getTime() - new Date(bEntered).getTime()
    }
    if (aEntered) return -1
    if (bEntered) return 1

    // Final tiebreaker: name
    const aName = (a.name || '').toLowerCase()
    const bName = (b.name || '').toLowerCase()
    return aName.localeCompare(bName)
  })
}

export function PipelinePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [stages, setStages] = useState<Stage[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [highlightLeadId, setHighlightLeadId] = useState<string | null>(null)
  
  // Drag & drop state
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null)
  const [draggedOverStageId, setDraggedOverStageId] = useState<string | null>(null)
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null)
  const leadCardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Toast state
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Move stage state
  const [selectedStageId, setSelectedStageId] = useState<Record<string, string>>({})

  // Create lead modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    // Handle lead query param - highlight and scroll
    const leadId = searchParams.get('lead')
    if (leadId) {
      setHighlightLeadId(leadId)
      setTimeout(() => {
        const cardElement = leadCardRefs.current.get(leadId)
        if (cardElement) {
          cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 100)
      setTimeout(() => setHighlightLeadId(null), 3000)
    }
  }, [searchParams])

  const loadData = async (loadStages = true) => {
    if (loadStages) {
      setLoading(true)
    }
    setError(null)
    try {
      if (loadStages) {
        const stagesData = await supabase
          .from('pipeline_stages')
          .select('id, name, position, sla_enabled, sla_days, sla_warn_days')
          .order('position', { ascending: true })
        
        if (stagesData.error) throw stagesData.error
        setStages(
          (stagesData.data || []).map((s) => ({
            ...s,
            sla_enabled: s.sla_enabled ?? false,
          }))
        )
      }

      // Fetch leads from RPC get_pipeline_board()
      const { data: boardData, error: boardError } = await supabase.rpc(
        'get_pipeline_board'
      )

      if (boardError) throw boardError

      // Normalize board rows to Lead type
      setLeads(
        (boardData || []).map((row: BoardRow) => {
          const displayName =
            row.lead_name || `Lead ${row.lead_id.slice(0, 8)}...`

          return {
            id: row.lead_id,
            name: displayName,
            stage_id: row.stage_id,
            stage_name: row.stage_name,
            entered_at: row.entered_at,
            sla_state: row.sla_state || null,
            sla_due_at: row.sla_due_at || null,
            sla_days_left: row.sla_days_left || null,
            sla_priority: row.sla_priority || null,
          }
        })
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      if (loadStages) {
        setLoading(false)
      }
    }
  }

  // Drag & drop handlers
  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    if (movingLeadId === lead.id) {
      e.preventDefault()
      return
    }
    setDraggedLead(lead)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', lead.id)
  }

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (draggedLead && draggedLead.stage_id !== stageId) {
      setDraggedOverStageId(stageId)
      e.dataTransfer.dropEffect = 'move'
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDraggedOverStageId(null)
  }

  const handleDrop = async (e: React.DragEvent, toStageId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDraggedOverStageId(null)

    if (!draggedLead) return

    const fromStageId = draggedLead.stage_id

    if (fromStageId === toStageId) {
      setDraggedLead(null)
      return
    }

    if (movingLeadId === draggedLead.id) {
      setDraggedLead(null)
      return
    }

    // Optimistic update
    const previousLeads = leads
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === draggedLead.id
          ? { ...lead, stage_id: toStageId }
          : lead
      )
    )
    setMovingLeadId(draggedLead.id)
    setDraggedLead(null)

    try {
      const idempotencyKey = generateIdempotencyKey(
        draggedLead.id,
        fromStageId,
        toStageId
      )

      await pipelineApi.moveLeadStage(draggedLead.id, toStageId, idempotencyKey)

      await loadData(false)
      setToast({ type: 'success', message: 'Etapa actualizada ✅' })
    } catch (err) {
      setLeads(previousLeads)
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Error al mover lead' })
    } finally {
      setMovingLeadId(null)
    }
  }

  // Handle move stage via select
  const handleMoveStage = async (leadId: string, lead: Lead) => {
    if (!lead.stage_id) return

    const toStageId = selectedStageId[leadId] || lead.stage_id

    if (toStageId === lead.stage_id) return

    setMovingLeadId(leadId)

    try {
      const idempotencyKey = generateIdempotencyKey(
        leadId,
        lead.stage_id,
        toStageId
      )

      await pipelineApi.moveLeadStage(leadId, toStageId, idempotencyKey)

      await loadData(false)
      setToast({ type: 'success', message: 'Etapa actualizada ✅' })
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Error al mover lead' })
    } finally {
      setMovingLeadId(null)
    }
  }

  // Handle create lead
  const handleCreateLead = async (data: {
    full_name: string
    phone?: string
    email?: string
    source?: string
    notes?: string
    stage_id: string
  }) => {
    const newLead = await pipelineApi.createLead(data)
    setIsCreateModalOpen(false)
    navigate(`/leads/${newLead.id}`)
  }

  // Group leads by stage and sort
  const leadsByStage = useMemo(() => {
    const grouped = new Map<string, Lead[]>()
    stages.forEach((stage) => {
      const stageLeads = leads.filter((lead) => lead.stage_id === stage.id)
      grouped.set(stage.id, sortLeadsBySla(stageLeads))
    })
    return grouped
  }, [stages, leads])

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h2 className="text-xl font-semibold m-0">Pipeline</h2>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="card flex-shrink-0"
              style={{ width: '260px', height: '400px', background: 'var(--bg)' }}
            />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h2 className="text-xl font-semibold m-0">Pipeline</h2>
        </div>
        <div className="error-box">
          <p style={{ margin: '0 0 12px 0' }}>{error}</p>
          <button onClick={() => loadData()} className="btn btn-primary">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (leads.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h2 className="text-xl font-semibold m-0">Pipeline</h2>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="btn btn-primary text-sm"
            >
              Nuevo lead
            </button>
            <button
              onClick={() => navigate('/pipeline/settings')}
              className="btn btn-ghost text-sm"
            >
              Configurar SLA
            </button>
          </div>
        </div>
        <div className="card text-center p-12">
          <p className="mb-4 text-base">Aún no hay leads en el pipeline.</p>
          <p className="text-muted mb-6">Crea tu primer lead para comenzar.</p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn btn-primary"
          >
            Nuevo lead
          </button>
        </div>
        <LeadCreateModal
          stages={stages.map(stageToPipelineStage)}
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSubmit={handleCreateLead}
        />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-xl font-semibold m-0">Pipeline</h2>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn btn-primary text-sm"
          >
            Nuevo lead
          </button>
          <button
            onClick={() => navigate('/focus')}
            className="btn btn-ghost text-sm"
          >
            Qué hacer hoy
          </button>
          <button
            onClick={() => navigate('/pipeline/settings')}
            className="btn btn-ghost text-sm"
          >
            Configurar SLA
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin">
        {stages.map((stage) => {
          const stageLeads = leadsByStage.get(stage.id) || []
          const counts = aggregateCounts(stageLeads)
          const isDragOver = draggedOverStageId === stage.id

          return (
            <div
              key={stage.id}
              className="card flex-shrink-0 flex flex-col"
              style={{
                width: '260px',
                maxHeight: 'calc(100vh - 180px)',
                border: isDragOver ? '2px solid var(--text)' : undefined,
                transition: 'all 0.2s',
                padding: '10px',
              }}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              {/* Column Header */}
              <div className="mb-2 pb-2 border-b-2 border-border">
                <div className="font-semibold text-sm mb-1.5">
                  {stage.name}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                  <span className="text-muted">Total: {counts.total}</span>
                  {counts.overdue > 0 && (
                    <span className="badge badge-overdue text-[10px] px-1.5 py-0.5">
                      {counts.overdue}
                    </span>
                  )}
                  {counts.warn > 0 && (
                    <span className="badge badge-warn text-[10px] px-1.5 py-0.5">
                      {counts.warn}
                    </span>
                  )}
                  {counts.ok > 0 && (
                    <span className="badge badge-ok text-[10px] px-1.5 py-0.5">
                      {counts.ok}
                    </span>
                  )}
                </div>
              </div>

              {/* Leads List */}
              <div className="flex-1 overflow-y-auto min-h-[150px]">
                {stageLeads.length === 0 ? (
                  <div className="text-center p-4 text-xs text-muted">
                    Sin leads
                  </div>
                ) : (
                  stageLeads.map((lead) => {
                    const isHighlighted = highlightLeadId === lead.id
                    const isMoving = movingLeadId === lead.id
                    const isDragged = draggedLead?.id === lead.id
                    const currentSelectedStage = selectedStageId[lead.id] || lead.stage_id || ''

                    return (
                      <div
                        key={lead.id}
                        ref={(el) => {
                          if (el) {
                            leadCardRefs.current.set(lead.id, el)
                          } else {
                            leadCardRefs.current.delete(lead.id)
                          }
                        }}
                        draggable={!isMoving}
                        onDragStart={(e) => handleDragStart(e, lead)}
                        className={`card mb-2 ${getSlaBorderClass(lead.sla_state)} ${
                          isHighlighted ? 'ring-2 ring-primary' : ''
                        }`}
                        style={{
                          padding: '8px',
                          opacity: isMoving || isDragged ? 0.5 : 1,
                          cursor: isMoving ? 'not-allowed' : 'grab',
                          transition: 'all 0.2s',
                          background: isHighlighted ? 'rgba(0, 0, 0, 0.02)' : 'var(--card)',
                        }}
                      >
                        {/* Header compacto */}
                        <div className="flex items-start justify-between gap-1.5 mb-1.5">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm leading-tight mb-0.5">
                              {isMoving ? (
                                <span className="text-xs text-muted">Moviendo...</span>
                              ) : (
                                lead.name
                              )}
                            </div>
                            {lead.entered_at && (
                              <div className="text-[10px] text-muted">
                                {formatHumanDate(lead.entered_at)}
                              </div>
                            )}
                          </div>
                          {!isMoving && (
                            <div className={getSlaBadgeClass(lead.sla_state)}>
                              {getSlaBadgeLabel(lead.sla_state)}
                            </div>
                          )}
                        </div>

                        {/* Acciones compactas */}
                        {!isMoving && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <button
                              onClick={() => navigate(`/leads/${lead.id}`)}
                              className="btn btn-primary text-[10px] px-2 py-1 flex-1"
                            >
                              Abrir
                            </button>
                            {stages.length > 0 && (
                              <>
                                <select
                                  value={currentSelectedStage}
                                  onChange={(e) =>
                                    setSelectedStageId((prev) => ({
                                      ...prev,
                                      [lead.id]: e.target.value,
                                    }))
                                  }
                                  disabled={isMoving}
                                  className="select text-[10px] min-w-[80px] flex-1"
                                >
                                  {stages.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleMoveStage(lead.id, lead)}
                                  disabled={
                                    isMoving ||
                                    !currentSelectedStage ||
                                    currentSelectedStage === lead.stage_id
                                  }
                                  className="btn btn-primary text-[10px] px-1.5 py-1"
                                  title="Mover"
                                >
                                  ✓
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Create Lead Modal */}
      <LeadCreateModal
        stages={stages.map(stageToPipelineStage)}
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateLead}
      />

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
