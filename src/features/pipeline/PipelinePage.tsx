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
import { PipelineTableView } from './views/PipelineTableView'
import { PipelineInsightsPage } from './insights/PipelineInsightsPage'

const STORAGE_KEY_VIEW = 'pipeline:viewMode'
type ViewMode = 'table' | 'kanban' | 'insights'

function getStoredViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY_VIEW)
    if (v === 'table' || v === 'kanban' || v === 'insights') return v
  } catch (_) {}
  return 'table'
}

function setStoredViewMode(mode: ViewMode) {
  try {
    localStorage.setItem(STORAGE_KEY_VIEW, mode)
  } catch (_) {}
}

const initialState: PipelineState = {
  stages: [],
  leads: [],
  loading: true,
  error: null,
}

export function PipelinePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<ViewMode>(getStoredViewMode)
  const [state, dispatch] = useReducer(pipelineReducer, initialState)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [draggedLead, setDraggedLead] = useState<Lead | null>(null)
  const kanbanRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    setStoredViewMode(activeTab)
  }, [activeTab])

  useEffect(() => {
    const leadId = searchParams.get('lead')
    if (leadId && state.leads.length > 0) {
      setActiveTab('kanban')
      setTimeout(() => {
        kanbanRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, state.leads.length, setSearchParams])

  const loadData = async () => {
    dispatch({ type: 'LOAD_START' })
    try {
      const [stages, leads] = await Promise.all([
        pipelineApi.getStages(),
        pipelineApi.getLeads('activos'),
      ])
      dispatch({ type: 'LOAD_SUCCESS', payload: { stages, leads } })
    } catch (err: unknown) {
      dispatch({ type: 'LOAD_ERROR', payload: err instanceof Error ? err.message : 'Error al cargar datos' })
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
      await loadData()
    } catch (err: unknown) {
      dispatch({
        type: 'MOVE_ROLLBACK',
        payload: { leadId: draggedLead.id, fromStageId },
      })
      alert(err instanceof Error ? err.message : 'Error al mover el lead')
    } finally {
      setDraggedLead(null)
    }
  }

  const handleViewInKanban = (leadId?: string) => {
    setActiveTab('kanban')
    if (leadId && kanbanRef.current) {
      setTimeout(() => {
        kanbanRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }

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
        {activeTab === 'kanban' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary text-sm"
          >
            + Nuevo lead
          </button>
        )}
      </div>

      <div
        className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100/80 p-0.5 gap-0.5"
        role="tablist"
        aria-label="Vista del pipeline"
      >
        <button
          role="tab"
          aria-selected={activeTab === 'table'}
          onClick={() => setActiveTab('table')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            activeTab === 'table' ? 'bg-white text-neutral-900 ring-1 ring-neutral-200 font-medium' : 'text-neutral-600 hover:bg-neutral-200/60'
          }`}
        >
          Tabla
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'kanban'}
          onClick={() => setActiveTab('kanban')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            activeTab === 'kanban' ? 'bg-white text-neutral-900 ring-1 ring-neutral-200 font-medium' : 'text-neutral-600 hover:bg-neutral-200/60'
          }`}
        >
          Kanban
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'insights'}
          onClick={() => setActiveTab('insights')}
          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
            activeTab === 'insights' ? 'bg-white text-neutral-900 ring-1 ring-neutral-200 font-medium' : 'text-neutral-600 hover:bg-neutral-200/60'
          }`}
        >
          Insights
        </button>
      </div>

      {activeTab === 'table' && <PipelineTableView />}

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

      {activeTab === 'kanban' && (
        <LeadCreateModal
          stages={state.stages}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreateLead}
        />
      )}
    </div>
  )
}
