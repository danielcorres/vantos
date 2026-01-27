import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { pipelineApi, type Lead } from '../features/pipeline/pipeline.api'
import { generateIdempotencyKey } from '../features/pipeline/pipeline.store'
import { LeadCreateModal } from '../features/pipeline/components/LeadCreateModal'
import { Toast } from '../shared/components/Toast'
import { todayLocalYmd, addDaysYmd } from '../shared/utils/dates'

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

// Helper: Format date to human readable (ej: "Hoy", "Ayer", "26 ene")
function formatHumanDate(dateString: string | null | undefined): string {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    const today = todayLocalYmd()
    const dateYmd = date.toISOString().split('T')[0]
    
    if (dateYmd === today) return 'Hoy'
    
    const yesterday = addDaysYmd(today, -1)
    if (dateYmd === yesterday) return 'Ayer'
    
    // Formato: "26 ene"
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    const day = date.getDate()
    const month = months[date.getMonth()]
    return `${day} ${month}`
  } catch {
    return ''
  }
}

// Helper: Get follow-up status from next_follow_up_at
function getFollowUpStatus(nextFollowUpAt: string | null | undefined): 'overdue' | 'today' | 'future' | 'none' {
  if (!nextFollowUpAt) return 'none'
  
  const today = todayLocalYmd()
  const followUpYmd = nextFollowUpAt.split('T')[0]
  
  if (followUpYmd < today) return 'overdue'
  if (followUpYmd === today) return 'today'
  return 'future'
}

// Helper: Get follow-up status class
function getFollowUpStatusClass(status: ReturnType<typeof getFollowUpStatus>): string {
  if (status === 'overdue') return 'text-red-700 bg-red-50'
  if (status === 'today') return 'text-amber-700 bg-amber-50'
  return 'text-muted'
}

// Helper: Get follow-up status label
function getFollowUpStatusLabel(status: ReturnType<typeof getFollowUpStatus>): string {
  if (status === 'overdue') return 'Seguimiento vencido'
  if (status === 'today') return 'Seguimiento hoy'
  if (status === 'future') return 'En tiempo'
  return 'Sin fecha'
}

// Helper: Sort leads by follow-up priority
function sortLeadsByFollowUp(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => {
    const aStatus = getFollowUpStatus(a.next_follow_up_at)
    const bStatus = getFollowUpStatus(b.next_follow_up_at)
    
    // Priority: overdue > today > future > none
    const statusOrder: Record<string, number> = {
      overdue: 0,
      today: 1,
      future: 2,
      none: 3,
    }
    
    const aOrder = statusOrder[aStatus] ?? 3
    const bOrder = statusOrder[bStatus] ?? 3
    
    if (aOrder !== bOrder) {
      return aOrder - bOrder
    }
    
    // Same status: sort by next_follow_up_at (earlier first)
    if (a.next_follow_up_at && b.next_follow_up_at) {
      return new Date(a.next_follow_up_at).getTime() - new Date(b.next_follow_up_at).getTime()
    }
    if (a.next_follow_up_at) return -1
    if (b.next_follow_up_at) return 1
    
    // Fallback: by name
    return (a.full_name || '').localeCompare(b.full_name || '')
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
  const [selectedStageFilter, setSelectedStageFilter] = useState<string | null>(null)
  
  // Drag & drop state (desktop only)
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

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [stagesData, leadsData] = await Promise.all([
        pipelineApi.getStages(),
        pipelineApi.getLeads(),
      ])

      setStages(stagesData.map((s) => ({
        id: s.id,
        name: s.name,
        position: s.position,
      })))

      setLeads(leadsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  // Drag & drop handlers (desktop only)
  const handleDragStart = (e: React.DragEvent, lead: Lead) => {
    if (isMobile || movingLeadId === lead.id) {
      e.preventDefault()
      return
    }
    setDraggedLead(lead)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', lead.id)
  }

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    if (isMobile) return
    e.preventDefault()
    e.stopPropagation()
    if (draggedLead && draggedLead.stage_id !== stageId) {
      setDraggedOverStageId(stageId)
      e.dataTransfer.dropEffect = 'move'
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (isMobile) return
    e.preventDefault()
    e.stopPropagation()
    setDraggedOverStageId(null)
  }

  const handleDrop = async (e: React.DragEvent, toStageId: string) => {
    if (isMobile) return
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

      await loadData()
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

      await loadData()
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
    next_follow_up_at?: string
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
      grouped.set(stage.id, sortLeadsByFollowUp(stageLeads))
    })
    return grouped
  }, [stages, leads])

  // Filtered leads for mobile list view
  const filteredLeads = useMemo(() => {
    let filtered = leads
    if (selectedStageFilter) {
      filtered = filtered.filter((lead) => lead.stage_id === selectedStageFilter)
    }
    return sortLeadsByFollowUp(filtered)
  }, [leads, selectedStageFilter])

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

  if (leads.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">Pipeline</h1>
            <p className="text-sm text-muted">Seguimiento de tus oportunidades activas</p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn btn-primary text-sm"
          >
            + Nuevo lead
          </button>
        </div>
        <div className="card text-center p-12">
          <p className="mb-4 text-base">Aún no hay leads en el pipeline.</p>
          <p className="text-muted mb-6">Crea tu primer lead para comenzar.</p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn btn-primary"
          >
            + Nuevo lead
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold mb-1">Pipeline</h1>
          <p className="text-sm text-muted">Seguimiento de tus oportunidades activas</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="btn btn-primary text-sm"
          >
            + Nuevo lead
          </button>
          <button
            onClick={() => navigate('/focus')}
            className="btn btn-ghost text-sm"
          >
            Qué hacer hoy
          </button>
        </div>
      </div>

      {/* Mobile: List view with stage filters */}
      {isMobile ? (
        <div className="space-y-4">
          {/* Stage filters */}
          <div className="flex gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedStageFilter(null)}
              className={`px-3 py-1.5 text-xs rounded whitespace-nowrap ${
                selectedStageFilter === null
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-bg border border-border text-text'
              }`}
            >
              Todos
            </button>
            {stages.map((stage) => (
              <button
                key={stage.id}
                onClick={() => setSelectedStageFilter(stage.id)}
                className={`px-3 py-1.5 text-xs rounded whitespace-nowrap ${
                  selectedStageFilter === stage.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-bg border border-border text-text'
                }`}
              >
                {stage.name}
              </button>
            ))}
          </div>

          {/* Leads list */}
          <div className="space-y-2">
            {filteredLeads.map((lead) => {
              const isHighlighted = highlightLeadId === lead.id
              const followUpStatus = getFollowUpStatus(lead.next_follow_up_at)
              const stage = stages.find((s) => s.id === lead.stage_id)

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
                  className={`card p-3 ${
                    isHighlighted ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => navigate(`/leads/${lead.id}`)}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm mb-1">{lead.full_name}</div>
                      <div className="flex items-center gap-2 flex-wrap text-xs text-muted">
                        {lead.source && (
                          <span className="px-2 py-0.5 bg-black/5 rounded">{lead.source}</span>
                        )}
                        {stage && (
                          <span className="px-2 py-0.5 bg-black/5 rounded">{stage.name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1 text-xs text-muted">
                    {lead.last_contact_at && (
                      <div>Último: {formatHumanDate(lead.last_contact_at)}</div>
                    )}
                    {lead.next_follow_up_at && (
                      <div className={`px-2 py-1 rounded ${getFollowUpStatusClass(followUpStatus)}`}>
                        Siguiente: {formatHumanDate(lead.next_follow_up_at)} · {getFollowUpStatusLabel(followUpStatus)}
                      </div>
                    )}
                    {!lead.next_follow_up_at && (
                      <div className="text-muted">Sin fecha de seguimiento</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* Desktop: Kanban Board */
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin">
          {stages.map((stage) => {
            const stageLeads = leadsByStage.get(stage.id) || []
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
                  <div className="text-xs text-muted">
                    {stageLeads.length} {stageLeads.length === 1 ? 'lead' : 'leads'}
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
                      const followUpStatus = getFollowUpStatus(lead.next_follow_up_at)

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
                          draggable={!isMoving && !isMobile}
                          onDragStart={(e) => handleDragStart(e, lead)}
                          className={`card mb-2 ${
                            followUpStatus === 'overdue' ? 'border-l-[3px] border-l-red-500' :
                            followUpStatus === 'today' ? 'border-l-[3px] border-l-amber-500' :
                            ''
                          } ${
                            isHighlighted ? 'ring-2 ring-primary' : ''
                          }`}
                          style={{
                            padding: '8px',
                            opacity: isMoving || isDragged ? 0.5 : 1,
                            cursor: isMoving ? 'not-allowed' : isMobile ? 'pointer' : 'grab',
                            transition: 'all 0.2s',
                            background: isHighlighted ? 'rgba(0, 0, 0, 0.02)' : 'var(--card)',
                          }}
                          onClick={() => isMobile && navigate(`/leads/${lead.id}`)}
                        >
                          {/* Header */}
                          <div className="flex items-start justify-between gap-1.5 mb-1.5">
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm leading-tight mb-0.5">
                                {isMoving ? (
                                  <span className="text-xs text-muted">Moviendo...</span>
                                ) : (
                                  lead.full_name
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-muted">
                                {lead.source && (
                                  <span>{lead.source}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Seguimiento info */}
                          <div className="space-y-1 mb-2 text-xs">
                            {lead.last_contact_at && (
                              <div className="text-muted">Último: {formatHumanDate(lead.last_contact_at)}</div>
                            )}
                            {lead.next_follow_up_at && (
                              <div className={`px-1.5 py-0.5 rounded text-[10px] ${getFollowUpStatusClass(followUpStatus)}`}>
                                Siguiente: {formatHumanDate(lead.next_follow_up_at)}
                              </div>
                            )}
                          </div>

                          {/* Acciones */}
                          {!isMoving && (
                            <div className="flex items-center gap-1 flex-wrap">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  navigate(`/leads/${lead.id}`)
                                }}
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
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {stages.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.name}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleMoveStage(lead.id, lead)
                                    }}
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
      )}

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
