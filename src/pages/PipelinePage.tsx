import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { pipelineApi, type Lead } from '../features/pipeline/pipeline.api'
import { generateIdempotencyKey } from '../features/pipeline/pipeline.store'
import { LeadCreateModal } from '../features/pipeline/components/LeadCreateModal'
import { Toast } from '../shared/components/Toast'
import { todayLocalYmd } from '../shared/utils/dates'
import { useReducedMotion } from '../shared/hooks/useReducedMotion'

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

// Helper: Format date to human readable (ej: "24 ene")
function formatHumanDateShort(dateString: string | null | undefined): string {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    const day = date.getDate()
    const month = months[date.getMonth()]
    return `${day} ${month}`
  } catch {
    return ''
  }
}

// Helper: Format next follow up date (ej: "Hoy", "30 ene")
function formatNextFollowUp(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  try {
    const date = new Date(dateString)
    const today = todayLocalYmd()
    const dateYmd = date.toISOString().split('T')[0]
    
    if (dateYmd === today) return 'Hoy'
    
    // Formato: "30 ene"
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    const day = date.getDate()
    const month = months[date.getMonth()]
    return `${day} ${month}`
  } catch {
    return '—'
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

// Helper: Get follow-up status color class (solo para el texto "Próx")
function getFollowUpStatusColor(status: ReturnType<typeof getFollowUpStatus>): string {
  if (status === 'overdue' || status === 'today') return 'text-red-700 font-medium'
  if (status === 'future') return 'text-amber-700 font-medium'
  return 'text-muted'
}

// Helper: Get follow-up emoji
function getFollowUpEmoji(status: ReturnType<typeof getFollowUpStatus>): string {
  if (status === 'overdue' || status === 'today') return '🔴'
  if (status === 'future') return '🟡'
  return '⚪'
}

// Helper: Sort leads by intelligent priority
function sortLeadsByPriority(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => {
    const aStatus = getFollowUpStatus(a.next_follow_up_at)
    const bStatus = getFollowUpStatus(b.next_follow_up_at)
    
    // Priority order: overdue > today > future (closer first) > none > oldest created
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
    
    // Same status: sort by next_follow_up_at (earlier first for future)
    if (aStatus === 'future' && bStatus === 'future') {
      if (a.next_follow_up_at && b.next_follow_up_at) {
        return new Date(a.next_follow_up_at).getTime() - new Date(b.next_follow_up_at).getTime()
      }
    }
    
    // For overdue/today: sort by next_follow_up_at (more overdue first)
    if ((aStatus === 'overdue' || aStatus === 'today') && (bStatus === 'overdue' || bStatus === 'today')) {
      if (a.next_follow_up_at && b.next_follow_up_at) {
        return new Date(a.next_follow_up_at).getTime() - new Date(b.next_follow_up_at).getTime()
      }
    }
    
    // None or same priority: sort by created_at (oldest first)
    const aCreated = new Date(a.created_at).getTime()
    const bCreated = new Date(b.created_at).getTime()
    return aCreated - bCreated
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
  const [highlightScope, setHighlightScope] = useState<'created' | 'moved' | 'followup' | null>(null)
  const [highlightedFollowUpCell, setHighlightedFollowUpCell] = useState<string | null>(null)
  const [expandedStageIds, setExpandedStageIds] = useState<Set<string>>(new Set())
  
  // Toast state
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  
  // Reduced motion
  const prefersReducedMotion = useReducedMotion()

  // Move stage state
  const [selectedStageId, setSelectedStageId] = useState<Record<string, string>>({})
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null)

  // Date editing state
  const [editingDateLeadId, setEditingDateLeadId] = useState<string | null>(null)
  const [editingDateValue, setEditingDateValue] = useState<string>('')
  const [updatingFollowUp, setUpdatingFollowUp] = useState<string | null>(null)

  // Create lead modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Collapsed stages state (accordion) - default: open if has leads
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set())

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false)

  const leadCardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const dateInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())
  const stageContentRefs = useRef<Map<string, HTMLDivElement>>(new Map())

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

  // Initialize collapsed stages: open if has leads
  useEffect(() => {
    if (stages.length > 0 && leads.length > 0) {
      setCollapsedStages((prev) => {
        const next = new Set(prev)
        const newExpanded = new Set<string>()
        stages.forEach((stage) => {
          const stageLeads = leads.filter((l) => l.stage_id === stage.id)
          if (stageLeads.length === 0) {
            next.add(stage.id)
          } else {
            next.delete(stage.id)
            newExpanded.add(stage.id)
          }
        })
        // Track expanded stages for urgent glow
        setExpandedStageIds(newExpanded)
        // Remove glow after initial animation
        setTimeout(() => {
          setExpandedStageIds(new Set())
        }, 800)
        return next
      })
    }
  }, [stages, leads])

  useEffect(() => {
    // Handle lead query param - highlight and scroll
    const leadId = searchParams.get('lead')
    if (leadId) {
      setHighlightLeadId(leadId)
      // Expand stage containing this lead
      const lead = leads.find((l) => l.id === leadId)
      if (lead) {
        setCollapsedStages((prev) => {
          const next = new Set(prev)
          next.delete(lead.stage_id)
          return next
        })
      }
      setTimeout(() => {
        const cardElement = leadCardRefs.current.get(leadId)
        if (cardElement) {
          cardElement.scrollIntoView({ 
            behavior: prefersReducedMotion ? 'auto' : 'smooth', 
            block: 'center' 
          })
        }
      }, 100)
      setTimeout(() => setHighlightLeadId(null), 3000)
    }
  }, [searchParams, leads])

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

  // Handle move stage (immediate change)
  const handleMoveStage = async (leadId: string, lead: Lead, toStageId: string) => {
    if (!lead.stage_id || toStageId === lead.stage_id) return

    setMovingLeadId(leadId)

    try {
      const idempotencyKey = generateIdempotencyKey(
        leadId,
        lead.stage_id,
        toStageId
      )

      await pipelineApi.moveLeadStage(leadId, toStageId, idempotencyKey)

      await loadData()
      
      // Highlight and expand destination stage
      setHighlightLeadId(leadId)
      setHighlightScope('moved')
      setCollapsedStages((prev) => {
        const next = new Set(prev)
        next.delete(toStageId)
        return next
      })
      
      // Scroll to lead in new stage
      setTimeout(() => {
        const cardElement = leadCardRefs.current.get(leadId)
        if (cardElement) {
          cardElement.scrollIntoView({ 
            behavior: prefersReducedMotion ? 'auto' : 'smooth', 
            block: 'center' 
          })
        }
      }, 150)
      
      setTimeout(() => {
        setHighlightLeadId(null)
        setHighlightScope(null)
      }, 1000)
      
      setToast({ type: 'success', message: 'Actualizado' })
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Error al mover lead' })
    } finally {
      setMovingLeadId(null)
    }
  }

  // Handle update next follow up
  const handleUpdateNextFollowUp = async (leadId: string, nextFollowUpAt: string | null) => {
    setUpdatingFollowUp(leadId)

    try {
      await pipelineApi.updateLead(leadId, {
        next_follow_up_at: nextFollowUpAt,
      })

      await loadData()
      
      // Highlight only the follow-up cell
      setHighlightedFollowUpCell(leadId)
      setTimeout(() => {
        setHighlightedFollowUpCell(null)
      }, 800)
      
      setToast({ type: 'success', message: 'Actualizado' })
      setEditingDateLeadId(null)
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Error al actualizar fecha' })
    } finally {
      setUpdatingFollowUp(null)
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
    
    // Reload data to get the new lead
    await loadData()
    
    // Highlight and expand stage
    setHighlightLeadId(newLead.id)
    setHighlightScope('created')
    setCollapsedStages((prev) => {
      const next = new Set(prev)
      next.delete(data.stage_id)
      return next
    })
    
    // Scroll to new lead
    setTimeout(() => {
      const cardElement = leadCardRefs.current.get(newLead.id)
      if (cardElement) {
        cardElement.scrollIntoView({ 
          behavior: prefersReducedMotion ? 'auto' : 'smooth', 
          block: 'center' 
        })
      }
    }, 200)
    
    // Remove highlight after animation
    setTimeout(() => {
      setHighlightLeadId(null)
      setHighlightScope(null)
    }, 1200)
    
    setToast({ type: 'success', message: 'Lead creado' })
  }

  // Toggle stage collapse
  const toggleStage = (stageId: string) => {
    setCollapsedStages((prev) => {
      const next = new Set(prev)
      if (next.has(stageId)) {
        next.delete(stageId)
        // Track expanded for urgent glow
        setExpandedStageIds((expanded) => {
          const newExpanded = new Set(expanded)
          newExpanded.add(stageId)
          return newExpanded
        })
        // Remove glow after animation
        setTimeout(() => {
          setExpandedStageIds((expanded) => {
            const newExpanded = new Set(expanded)
            newExpanded.delete(stageId)
            return newExpanded
          })
        }, 800)
      } else {
        next.add(stageId)
      }
      return next
    })
  }

  // Start editing date
  const startEditingDate = (lead: Lead, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingDateLeadId(lead.id)
    setEditingDateValue(lead.next_follow_up_at?.split('T')[0] || '')
    setTimeout(() => {
      const input = dateInputRefs.current.get(lead.id)
      input?.focus()
    }, 0)
  }

  // Save date edit
  const saveDateEdit = (leadId: string) => {
    const newValue = editingDateValue || null
    const currentValue = leads.find((l) => l.id === leadId)?.next_follow_up_at?.split('T')[0] || null
    
    if (newValue !== currentValue) {
      handleUpdateNextFollowUp(leadId, newValue)
    } else {
      setEditingDateLeadId(null)
    }
  }

  // Group leads by stage and sort
  const leadsByStage = useMemo(() => {
    const grouped = new Map<string, Lead[]>()
    stages.forEach((stage) => {
      const stageLeads = leads.filter((lead) => lead.stage_id === stage.id)
      grouped.set(stage.id, sortLeadsByPriority(stageLeads))
    })
    return grouped
  }, [stages, leads])

  // Count urgent leads per stage
  const urgentCountsByStage = useMemo(() => {
    const counts = new Map<string, number>()
    stages.forEach((stage) => {
      const stageLeads = leadsByStage.get(stage.id) || []
      const urgent = stageLeads.filter((lead) => {
        const status = getFollowUpStatus(lead.next_follow_up_at)
        return status === 'overdue' || status === 'today'
      }).length
      counts.set(stage.id, urgent)
    })
    return counts
  }, [stages, leadsByStage])

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

      {/* Stages grouped view */}
      <div className="space-y-2">
        {stages.map((stage) => {
          const stageLeads = leadsByStage.get(stage.id) || []
          const isCollapsed = collapsedStages.has(stage.id)
          const urgentCount = urgentCountsByStage.get(stage.id) || 0

          return (
            <div key={stage.id} className="card">
              {/* Stage header (accordion) */}
              <button
                onClick={() => toggleStage(stage.id)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-black/5 transition-colors duration-150"
              >
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold">{stage.name}</span>
                  <span className="text-xs text-muted">
                    {stageLeads.length}
                    {urgentCount > 0 && ` · ${urgentCount} hoy`}
                  </span>
                </div>
                <span 
                  className="text-muted text-sm" 
                  style={{
                    transition: prefersReducedMotion ? 'none' : 'transform 200ms ease-out',
                    transform: isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)'
                  }}
                >
                  ▼
                </span>
              </button>

              {/* Stage content with animation */}
              <div
                ref={(el) => {
                  if (el) {
                    stageContentRefs.current.set(stage.id, el)
                  } else {
                    stageContentRefs.current.delete(stage.id)
                  }
                }}
                className="overflow-hidden"
                style={{
                  transition: prefersReducedMotion 
                    ? 'none' 
                    : 'max-height 200ms ease-out, opacity 200ms ease-out',
                  maxHeight: isCollapsed ? '0' : '5000px',
                  opacity: isCollapsed ? 0 : 1,
                }}
              >
                <div className="border-t border-border">
                  {stageLeads.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted">
                      Sin leads en esta etapa
                    </div>
                  ) : isMobile ? (
                    /* Mobile: Card view */
                    <div className="divide-y divide-border">
                      {stageLeads.map((lead, index) => {
                        const isHighlighted = highlightLeadId === lead.id
                        const followUpStatus = getFollowUpStatus(lead.next_follow_up_at)
                        const isUrgent = followUpStatus === 'overdue' || followUpStatus === 'today'
                        const isFirstUrgent = index === 0 && isUrgent
                        const isEditingDate = editingDateLeadId === lead.id
                        const currentSelectedStage = selectedStageId[lead.id] || lead.stage_id || ''
                        const showUrgentGlow = isFirstUrgent && expandedStageIds.has(stage.id)

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
                            onClick={() => navigate(`/leads/${lead.id}`)}
                            className={`px-3 py-2 cursor-pointer ${
                              prefersReducedMotion ? '' : 'transition-all duration-150 hover:bg-muted/40 hover:ring-1 hover:ring-border/40 active:scale-[0.998]'
                            } ${
                              isHighlighted && highlightScope === 'created' 
                                ? 'bg-primary/5 ring-1 ring-primary/20' 
                                : isHighlighted 
                                  ? 'bg-primary/5 ring-2 ring-primary' 
                                  : ''
                            } ${
                              isFirstUrgent ? 'border-l-4 border-l-red-500 bg-red-50/20' : ''
                            } ${
                              showUrgentGlow && !prefersReducedMotion ? 'ring-1 ring-primary/25' : ''
                            }`}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-start justify-between gap-2">
                                <div className="font-medium text-sm leading-tight">{lead.full_name}</div>
                                {lead.source && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-black/5 rounded text-muted whitespace-nowrap">
                                    {lead.source}
                                  </span>
                                )}
                              </div>

                              <div className="text-xs space-y-0.5">
                                <div className="text-muted/80">
                                  Creado: {formatHumanDateShort(lead.created_at)}
                                </div>
                                <div
                                  onClick={(e) => startEditingDate(lead, e)}
                                  className={`flex items-center gap-1 transition-all duration-200 ${
                                    highlightedFollowUpCell === lead.id 
                                      ? 'bg-primary/10 ring-1 ring-primary/30 rounded px-1 py-0.5' 
                                      : ''
                                  }`}
                                >
                                  {isEditingDate ? (
                                    <input
                                      ref={(el) => {
                                        if (el) {
                                          dateInputRefs.current.set(lead.id, el)
                                        } else {
                                          dateInputRefs.current.delete(lead.id)
                                        }
                                      }}
                                      type="date"
                                      value={editingDateValue}
                                      onChange={(e) => setEditingDateValue(e.target.value)}
                                      onBlur={() => saveDateEdit(lead.id)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          saveDateEdit(lead.id)
                                        } else if (e.key === 'Escape') {
                                          setEditingDateLeadId(null)
                                        }
                                      }}
                                      disabled={updatingFollowUp === lead.id}
                                      className="text-xs px-2 py-1 border border-border rounded bg-bg"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  ) : (
                                    <>
                                      <span className={getFollowUpStatusColor(followUpStatus)}>
                                        Próx: {formatNextFollowUp(lead.next_follow_up_at)}
                                      </span>
                                      <span>{getFollowUpEmoji(followUpStatus)}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-2 mt-1"
                              >
                                <select
                                  value={currentSelectedStage}
                                  onChange={(e) => {
                                    const newStageId = e.target.value
                                    setSelectedStageId((prev) => ({
                                      ...prev,
                                      [lead.id]: newStageId,
                                    }))
                                    handleMoveStage(lead.id, lead, newStageId)
                                  }}
                                  disabled={movingLeadId === lead.id}
                                  className="flex-1 text-xs px-2 py-1 border border-border rounded bg-bg"
                                >
                                  {stages.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    /* Desktop: Table view */
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-bg border-b border-border/50">
                          <tr>
                            <th className="text-left py-2 px-4 text-xs font-medium text-muted/70 uppercase tracking-wide">
                              Lead
                            </th>
                            <th className="text-left py-2 px-4 text-xs font-medium text-muted/70 uppercase tracking-wide">
                              Fuente
                            </th>
                            <th className="text-left py-2 px-4 text-xs font-medium text-muted/70 uppercase tracking-wide">
                              Seguimiento
                            </th>
                            <th className="text-left py-2 px-4 text-xs font-medium text-muted/70 uppercase tracking-wide">
                              Etapa
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {stageLeads.map((lead, index) => {
                            const isHighlighted = highlightLeadId === lead.id
                            const followUpStatus = getFollowUpStatus(lead.next_follow_up_at)
                            const isUrgent = followUpStatus === 'overdue' || followUpStatus === 'today'
                            const isFirstUrgent = index === 0 && isUrgent
                            const isEditingDate = editingDateLeadId === lead.id
                            const currentSelectedStage = selectedStageId[lead.id] || lead.stage_id || ''
                            const showUrgentGlow = isFirstUrgent && expandedStageIds.has(stage.id)

                            return (
                              <tr
                                key={lead.id}
                                ref={(el) => {
                                  if (el) {
                                    leadCardRefs.current.set(lead.id, el)
                                  } else {
                                    leadCardRefs.current.delete(lead.id)
                                  }
                                }}
                                onClick={() => navigate(`/leads/${lead.id}`)}
                                className={`cursor-pointer ${
                                  prefersReducedMotion ? '' : 'transition-all duration-150 hover:bg-muted/40 hover:ring-1 hover:ring-border/40 active:scale-[0.998]'
                                } ${
                                  isHighlighted && highlightScope === 'created' 
                                    ? 'bg-primary/5 ring-1 ring-primary/20' 
                                    : isHighlighted 
                                      ? 'bg-primary/5 ring-2 ring-primary' 
                                      : ''
                                } ${
                                  isFirstUrgent ? 'border-l-4 border-l-red-500 bg-red-50/20' : ''
                                } ${
                                  showUrgentGlow && !prefersReducedMotion ? 'ring-1 ring-primary/25' : ''
                                }`}
                              >
                                <td className="py-2 px-4">
                                  <div className="font-medium text-sm leading-tight">{lead.full_name}</div>
                                </td>
                                <td className="py-2 px-4">
                                  {lead.source ? (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-black/5 rounded text-muted">
                                      {lead.source}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted">—</span>
                                  )}
                                </td>
                                <td className="py-2 px-4">
                                  <div className="space-y-0.5 text-xs">
                                    <div className="text-muted/80">
                                      Creado: {formatHumanDateShort(lead.created_at)}
                                    </div>
                                    <div
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        startEditingDate(lead, e)
                                      }}
                                      className={`flex items-center gap-1 transition-all duration-200 ${
                                        highlightedFollowUpCell === lead.id 
                                          ? 'bg-primary/10 ring-1 ring-primary/30 rounded px-1 py-0.5' 
                                          : ''
                                      }`}
                                    >
                                      {isEditingDate ? (
                                        <input
                                          ref={(el) => {
                                            if (el) {
                                              dateInputRefs.current.set(lead.id, el)
                                            } else {
                                              dateInputRefs.current.delete(lead.id)
                                            }
                                          }}
                                          type="date"
                                          value={editingDateValue}
                                          onChange={(e) => setEditingDateValue(e.target.value)}
                                          onBlur={() => saveDateEdit(lead.id)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              saveDateEdit(lead.id)
                                            } else if (e.key === 'Escape') {
                                              setEditingDateLeadId(null)
                                            }
                                          }}
                                          disabled={updatingFollowUp === lead.id}
                                          className="text-xs px-2 py-1 border border-border rounded bg-bg"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                      ) : (
                                        <>
                                          <span className={getFollowUpStatusColor(followUpStatus)}>
                                            Próx: {formatNextFollowUp(lead.next_follow_up_at)}
                                          </span>
                                          <span>{getFollowUpEmoji(followUpStatus)}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <select
                                    value={currentSelectedStage}
                                    onChange={(e) => {
                                      e.stopPropagation()
                                      const newStageId = e.target.value
                                      setSelectedStageId((prev) => ({
                                        ...prev,
                                        [lead.id]: newStageId,
                                      }))
                                      handleMoveStage(lead.id, lead, newStageId)
                                    }}
                                    disabled={movingLeadId === lead.id}
                                    className="text-xs px-2 py-1 border border-border rounded bg-bg"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {stages.map((s) => (
                                      <option key={s.id} value={s.id}>
                                        {s.name}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
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
