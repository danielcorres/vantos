import { useEffect, useReducer, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { pipelineApi, type Lead } from './pipeline.api'
import {
  pipelineReducer,
  generateIdempotencyKey,
  type PipelineState,
} from './pipeline.store'
import { KanbanBoard } from './components/KanbanBoard'
import { LeadCreateModal } from './components/LeadCreateModal'
import { PipelineInsightsPage } from './insights/PipelineInsightsPage'

const initialState: PipelineState = {
  stages: [],
  leads: [],
  loading: true,
  error: null,
}

type Tab = 'kanban' | 'insights'

export function PipelinePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<Tab>('kanban')
  const [state, dispatch] = useReducer(pipelineReducer, initialState)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null)
  const kanbanRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadData()
  }, [])

  // Handle lead query param from Focus page
  useEffect(() => {
    const leadId = searchParams.get('lead')
    if (leadId && state.leads.length > 0) {
      setActiveTab('kanban')
      // Scroll to kanban and optionally highlight the lead
      setTimeout(() => {
        kanbanRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        // TODO: Add highlight logic for the specific lead card
      }, 100)
      // Remove query param after handling
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, state.leads.length, setSearchParams])

  const loadData = async () => {
    dispatch({ type: 'LOAD_START' })
    try {
      const [stages, leads] = await Promise.all([
        pipelineApi.getStages(),
        pipelineApi.getLeads(),
      ])
      dispatch({ type: 'LOAD_SUCCESS', payload: { stages, leads } })
    } catch (err: any) {
      dispatch({ type: 'LOAD_ERROR', payload: err.message || 'Error al cargar datos' })
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
    const newLead = await pipelineApi.createLead(data)
    dispatch({ type: 'CREATE_LEAD', payload: newLead })
    setIsModalOpen(false)
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

    // Optimistic update
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
      // Recargar para obtener datos actualizados
      await loadData()
    } catch (err: any) {
      // Rollback
      dispatch({
        type: 'MOVE_ROLLBACK',
        payload: { leadId: draggedLead.id, fromStageId },
      })
      alert(err.message || 'Error al mover el lead')
    } finally {
      setDraggedLead(null)
    }
  }

  const handleViewInKanban = (leadId?: string) => {
    setActiveTab('kanban')
    if (leadId && kanbanRef.current) {
      // Scroll to kanban and try to highlight the lead
      setTimeout(() => {
        kanbanRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        // Could add highlight logic here if needed
      }, 100)
    }
  }

  if (state.loading) {
    return <div style={{ textAlign: 'center', padding: '40px' }}>Cargando...</div>
  }

  if (state.error) {
    return (
      <div className="error-box" style={{ marginBottom: '16px' }}>
        {state.error}
      </div>
    )
  }

  return (
    <div>
      <div className="row space-between" style={{ marginBottom: '24px' }}>
        <h2 className="title">Pipeline</h2>
        {activeTab === 'kanban' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary"
          >
            Nuevo lead
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="row" style={{ gap: '8px', marginBottom: '24px', borderBottom: '2px solid var(--border)' }}>
        <button
          onClick={() => setActiveTab('kanban')}
          className="btn btn-ghost"
          style={{
            padding: '10px 16px',
            borderBottom: activeTab === 'kanban' ? '2px solid var(--text)' : '2px solid transparent',
            marginBottom: '-2px',
            borderRadius: '0',
            fontWeight: activeTab === 'kanban' ? '600' : '400',
          }}
        >
          Kanban
        </button>
        <button
          onClick={() => setActiveTab('insights')}
          className="btn btn-ghost"
          style={{
            padding: '10px 16px',
            borderBottom: activeTab === 'insights' ? '2px solid var(--text)' : '2px solid transparent',
            marginBottom: '-2px',
            borderRadius: '0',
            fontWeight: activeTab === 'insights' ? '600' : '400',
          }}
        >
          Insights
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'kanban' && (
        <div ref={kanbanRef}>
          <KanbanBoard
            stages={state.stages}
            leads={state.leads}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        </div>
      )}

      {activeTab === 'insights' && (
        <PipelineInsightsPage onViewInKanban={handleViewInKanban} />
      )}

      <LeadCreateModal
        stages={state.stages}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateLead}
      />
    </div>
  )
}
