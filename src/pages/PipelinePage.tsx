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
    
    const tomorrow = addDaysYmd(today, 1)
    if (dateYmd === tomorrow) return 'Mañana'
    
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
  if (status === 'overdue') return 'text-red-700 bg-red-50 border-red-200'
  if (status === 'today') return 'text-amber-700 bg-amber-50 border-amber-200'
  return 'text-muted'
}

// Helper: Get follow-up status label
function getFollowUpStatusLabel(status: ReturnType<typeof getFollowUpStatus>): string {
  if (status === 'overdue') return 'Vencido'
  if (status === 'today') return 'Hoy'
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
  
  // Toast state
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Move stage state
  const [selectedStageId, setSelectedStageId] = useState<Record<string, string>>({})
  const [selectedNextFollowUp, setSelectedNextFollowUp] = useState<Record<string, string>>({})
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null)
  const [updatingFollowUp, setUpdatingFollowUp] = useState<string | null>(null)

  // Create lead modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  // Collapsed stages state (accordion)
  const [collapsedStages, setCollapsedStages] = useState<Set<string>>(new Set())

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false)

  const leadCardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

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
          cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
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

  // Handle move stage
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

  // Handle update next follow up
  const handleUpdateNextFollowUp = async (leadId: string, nextFollowUpAt: string | null) => {
    setUpdatingFollowUp(leadId)

    try {
      await pipelineApi.updateLead(leadId, {
        next_follow_up_at: nextFollowUpAt,
      })

      await loadData()
      setToast({ type: 'success', message: 'Fecha actualizada ✅' })
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
    navigate(`/leads/${newLead.id}`)
  }

  // Toggle stage collapse
  const toggleStage = (stageId: string) => {
    setCollapsedStages((prev) => {
      const next = new Set(prev)
      if (next.has(stageId)) {
        next.delete(stageId)
      } else {
        next.add(stageId)
      }
      return next
    })
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
      <div className="space-y-3">
        {stages.map((stage) => {
          const stageLeads = leadsByStage.get(stage.id) || []
          const isCollapsed = collapsedStages.has(stage.id)
          const isMoving = movingLeadId !== null

          return (
            <div key={stage.id} className="card">
              {/* Stage header (accordion) */}
              <button
                onClick={() => toggleStage(stage.id)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-black/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold">{stage.name}</span>
                  <span className="text-sm text-muted">
                    {stageLeads.length} {stageLeads.length === 1 ? 'lead' : 'leads'}
                  </span>
                </div>
                <span className="text-muted text-xl">
                  {isCollapsed ? '▼' : '▲'}
                </span>
              </button>

              {/* Stage content */}
              {!isCollapsed && (
                <div className="border-t border-border">
                  {stageLeads.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted">
                      Sin leads en esta etapa
                    </div>
                  ) : isMobile ? (
                    /* Mobile: List view */
                    <div className="divide-y divide-border">
                      {stageLeads.map((lead) => {
                        const isHighlighted = highlightLeadId === lead.id
                        const followUpStatus = getFollowUpStatus(lead.next_follow_up_at)
                        const currentSelectedStage = selectedStageId[lead.id] || lead.stage_id || ''
                        const currentNextFollowUp = selectedNextFollowUp[lead.id] || lead.next_follow_up_at?.split('T')[0] || ''

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
                            className={`p-3 ${
                              isHighlighted ? 'bg-primary/5 ring-2 ring-primary' : ''
                            } ${
                              followUpStatus === 'overdue' ? 'border-l-4 border-l-red-500' :
                              followUpStatus === 'today' ? 'border-l-4 border-l-amber-500' :
                              ''
                            }`}
                          >
                            <div className="space-y-2">
                              <div>
                                <div className="font-semibold text-sm mb-1">{lead.full_name}</div>
                                {lead.source && (
                                  <span className="text-xs px-2 py-0.5 bg-black/5 rounded">
                                    {lead.source}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex-1 min-w-[120px]">
                                  <label className="text-xs text-muted block mb-1">Próximo seguimiento</label>
                                  <input
                                    type="date"
                                    value={currentNextFollowUp}
                                    onChange={(e) => setSelectedNextFollowUp((prev) => ({
                                      ...prev,
                                      [lead.id]: e.target.value,
                                    }))}
                                    onBlur={() => {
                                      const newValue = selectedNextFollowUp[lead.id] || ''
                                      if (newValue !== lead.next_follow_up_at?.split('T')[0]) {
                                        handleUpdateNextFollowUp(lead.id, newValue || null)
                                      }
                                    }}
                                    disabled={updatingFollowUp === lead.id}
                                    className="w-full text-xs px-2 py-1 border border-border rounded bg-bg"
                                  />
                                </div>
                                {lead.next_follow_up_at && (
                                  <div className={`px-2 py-1 rounded text-xs ${getFollowUpStatusClass(followUpStatus)}`}>
                                    {getFollowUpStatusLabel(followUpStatus)}
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2 flex-wrap">
                                <select
                                  value={currentSelectedStage}
                                  onChange={(e) =>
                                    setSelectedStageId((prev) => ({
                                      ...prev,
                                      [lead.id]: e.target.value,
                                    }))
                                  }
                                  disabled={isMoving || movingLeadId === lead.id}
                                  className="flex-1 text-xs px-2 py-1 border border-border rounded bg-bg min-w-[120px]"
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
                                    movingLeadId === lead.id ||
                                    !currentSelectedStage ||
                                    currentSelectedStage === lead.stage_id
                                  }
                                  className="btn btn-primary text-xs px-3 py-1"
                                >
                                  {movingLeadId === lead.id ? '...' : 'Mover'}
                                </button>
                                <button
                                  onClick={() => navigate(`/leads/${lead.id}`)}
                                  className="btn btn-ghost text-xs px-3 py-1"
                                >
                                  Abrir
                                </button>
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
                        <thead className="bg-bg border-b-2 border-border">
                          <tr>
                            <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted uppercase tracking-wide">
                              Nombre
                            </th>
                            <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted uppercase tracking-wide">
                              Fuente
                            </th>
                            <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted uppercase tracking-wide">
                              Próximo seguimiento
                            </th>
                            <th className="text-left py-2.5 px-4 text-xs font-semibold text-muted uppercase tracking-wide">
                              Acciones
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {stageLeads.map((lead) => {
                            const isHighlighted = highlightLeadId === lead.id
                            const followUpStatus = getFollowUpStatus(lead.next_follow_up_at)
                            const currentSelectedStage = selectedStageId[lead.id] || lead.stage_id || ''
                            const currentNextFollowUp = selectedNextFollowUp[lead.id] || lead.next_follow_up_at?.split('T')[0] || ''

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
                                className={`hover:bg-black/5 transition-colors ${
                                  isHighlighted ? 'bg-primary/5 ring-2 ring-primary' : ''
                                } ${
                                  followUpStatus === 'overdue' ? 'border-l-4 border-l-red-500' :
                                  followUpStatus === 'today' ? 'border-l-4 border-l-amber-500' :
                                  ''
                                }`}
                              >
                                <td className="py-3 px-4">
                                  <div className="font-semibold text-sm">{lead.full_name}</div>
                                </td>
                                <td className="py-3 px-4">
                                  {lead.source ? (
                                    <span className="text-xs px-2 py-1 bg-black/5 rounded">
                                      {lead.source}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-muted">—</span>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="date"
                                      value={currentNextFollowUp}
                                      onChange={(e) => setSelectedNextFollowUp((prev) => ({
                                        ...prev,
                                        [lead.id]: e.target.value,
                                      }))}
                                      onBlur={() => {
                                        const newValue = selectedNextFollowUp[lead.id] || ''
                                        if (newValue !== lead.next_follow_up_at?.split('T')[0]) {
                                          handleUpdateNextFollowUp(lead.id, newValue || null)
                                        }
                                      }}
                                      disabled={updatingFollowUp === lead.id}
                                      className="text-xs px-2 py-1 border border-border rounded bg-bg"
                                    />
                                    {lead.next_follow_up_at && (
                                      <span className={`text-xs px-2 py-1 rounded border ${getFollowUpStatusClass(followUpStatus)}`}>
                                        {formatHumanDate(lead.next_follow_up_at)} · {getFollowUpStatusLabel(followUpStatus)}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <select
                                      value={currentSelectedStage}
                                      onChange={(e) =>
                                        setSelectedStageId((prev) => ({
                                          ...prev,
                                          [lead.id]: e.target.value,
                                        }))
                                      }
                                      disabled={isMoving || movingLeadId === lead.id}
                                      className="text-xs px-2 py-1 border border-border rounded bg-bg"
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
                                        movingLeadId === lead.id ||
                                        !currentSelectedStage ||
                                        currentSelectedStage === lead.stage_id
                                      }
                                      className="btn btn-primary text-xs px-2 py-1"
                                      title="Mover etapa"
                                    >
                                      {movingLeadId === lead.id ? '...' : 'Mover'}
                                    </button>
                                    <button
                                      onClick={() => navigate(`/leads/${lead.id}`)}
                                      className="btn btn-ghost text-xs px-2 py-1"
                                    >
                                      Abrir
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
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
