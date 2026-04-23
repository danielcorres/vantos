import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { pipelineApi, type Lead } from '../features/pipeline/pipeline.api'
import { todayLocalYmd, addDaysYmd } from '../shared/utils/dates'

type StatusFilter = 'all' | 'overdue' | 'today' | 'future'

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

const ACTION_TYPE_LABELS: Record<string, string> = {
  contact: 'Contacto',
  meeting: 'Reunión',
}

function getActionTypeLabel(type: string | null | undefined): string {
  if (!type) return ''
  return ACTION_TYPE_LABELS[type] ?? type
}

// Usa next_action_at (el mismo campo que usa el Pipeline y el Kanban)
function getNextActionStatus(nextActionAt: string | null | undefined): 'overdue' | 'today' | 'future' | 'none' {
  if (!nextActionAt) return 'none'

  const today = todayLocalYmd()
  const actionYmd = nextActionAt.split('T')[0]

  if (actionYmd < today) return 'overdue'
  if (actionYmd === today) return 'today'
  return 'future'
}

function sortLeadsByNextAction(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => {
    const aStatus = getNextActionStatus(a.next_action_at)
    const bStatus = getNextActionStatus(b.next_action_at)

    const statusOrder: Record<string, number> = { overdue: 0, today: 1, future: 2, none: 3 }
    const aOrder = statusOrder[aStatus] ?? 3
    const bOrder = statusOrder[bStatus] ?? 3

    if (aOrder !== bOrder) return aOrder - bOrder

    if (a.next_action_at && b.next_action_at) {
      return new Date(a.next_action_at).getTime() - new Date(b.next_action_at).getTime()
    }
    if (a.next_action_at) return -1
    if (b.next_action_at) return 1

    return (a.full_name || '').localeCompare(b.full_name || '')
  })
}

function filterLeadsByStatus(leads: Lead[], status: StatusFilter): Lead[] {
  if (status === 'all') return leads
  return leads.filter((lead) => {
    const s = getNextActionStatus(lead.next_action_at)
    if (status === 'overdue') return s === 'overdue'
    if (status === 'today') return s === 'today'
    if (status === 'future') return s === 'future'
    return false
  })
}

// Helper: Filter leads by search text
function filterLeadsBySearch(leads: Lead[], searchText: string): Lead[] {
  if (!searchText.trim()) return leads
  
  const searchLower = searchText.toLowerCase()
  return leads.filter((lead) => {
    const name = (lead.full_name || '').toLowerCase()
    const source = (lead.source || '').toLowerCase()
    return name.includes(searchLower) || source.includes(searchLower)
  })
}

export function FocusPage() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchText, setSearchText] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)

    try {
      const allLeads = await pipelineApi.getLeads('activos')
      // Solo leads con next_follow_up_at o sin fecha (para mostrar todos)
      setLeads(allLeads)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  // Filter and sort leads
  const filteredLeads = useMemo(() => {
    let filtered = filterLeadsBySearch(leads, searchText)
    filtered = filterLeadsByStatus(filtered, statusFilter)
    return sortLeadsByNextAction(filtered)
  }, [leads, searchText, statusFilter])

  // Count by status
  const counts = useMemo(() => {
    const overdue = leads.filter((l: Lead) => getNextActionStatus(l.next_action_at) === 'overdue').length
    const today = leads.filter((l: Lead) => getNextActionStatus(l.next_action_at) === 'today').length
    const future = leads.filter((l: Lead) => getNextActionStatus(l.next_action_at) === 'future').length
    const none = leads.filter((l: Lead) => getNextActionStatus(l.next_action_at) === 'none').length

    return { total: leads.length, overdue, today, future, none }
  }, [leads])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">Qué hacer hoy</h1>
            <p className="text-sm text-muted">Leads que requieren seguimiento</p>
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
            <h1 className="text-2xl font-bold mb-1">Qué hacer hoy</h1>
            <p className="text-sm text-muted">Leads que requieren seguimiento</p>
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
            <h1 className="text-2xl font-bold mb-1">Qué hacer hoy</h1>
            <p className="text-sm text-muted">Leads que requieren seguimiento</p>
          </div>
        </div>
        <div className="card text-center p-12">
          <p className="mb-4 text-base">No hay leads con próxima acción programada.</p>
          <p className="text-muted mb-6">Configura el próximo paso en tus leads desde el Pipeline o el Kanban.</p>
          <button
            onClick={() => navigate('/pipeline')}
            className="btn btn-primary"
          >
            Ir al Pipeline
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Qué hacer hoy</h1>
          <p className="text-sm text-muted">Leads que requieren seguimiento</p>
        </div>
        <button onClick={() => loadData()} className="btn btn-ghost text-sm">
          Actualizar
        </button>
      </div>

      {/* Counters */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="card p-3">
          <div className="text-xs text-muted mb-1">Total</div>
          <div className="text-xl font-black">{counts.total}</div>
        </div>
        <div className="card p-3 bg-red-50 border border-red-200">
          <div className="text-xs text-red-700 mb-1">Vencidos</div>
          <div className="text-xl font-black text-red-700">{counts.overdue}</div>
        </div>
        <div className="card p-3 bg-amber-50 border border-amber-200">
          <div className="text-xs text-amber-700 mb-1">Hoy</div>
          <div className="text-xl font-black text-amber-700">{counts.today}</div>
        </div>
        <div className="card p-3 bg-blue-50 border border-blue-200">
          <div className="text-xs text-blue-700 mb-1">Futuro</div>
          <div className="text-xl font-black text-blue-700">{counts.future}</div>
        </div>
        <div className="card p-3">
          <div className="text-xs text-muted mb-1">Sin fecha</div>
          <div className="text-xl font-black">{counts.none}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3">
        <div className="flex flex-col gap-3">
          {/* Status Tabs */}
          <div className="flex gap-1 flex-wrap">
            {(['all', 'overdue', 'today', 'future'] as StatusFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === filter
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-bg border border-border text-text hover:bg-black/5'
                }`}
              >
                {filter === 'all'
                  ? 'Todos'
                  : filter === 'overdue'
                    ? 'Vencidos'
                    : filter === 'today'
                      ? 'Hoy'
                      : 'Futuro'}
              </button>
            ))}
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full text-sm border border-border rounded px-3 py-2 bg-bg text-text"
          />
        </div>
      </div>

      {/* Leads List */}
      {filteredLeads.length === 0 ? (
        <div className="card text-center p-6">
          <p className="text-muted">No hay resultados para los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLeads.map((lead) => {
            const actionStatus = getNextActionStatus(lead.next_action_at)
            const statusClass =
              actionStatus === 'overdue'
                ? 'border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20'
                : actionStatus === 'today'
                  ? 'border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20'
                  : ''

            return (
              <div
                key={lead.id}
                className={`card p-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${statusClass}`}
                onClick={() => navigate(`/leads/${lead.id}`)}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm mb-0.5">{lead.full_name}</div>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-muted">
                      {lead.source && (
                        <span className="px-2 py-0.5 bg-black/5 dark:bg-white/10 rounded">{lead.source}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  {lead.next_action_at ? (
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded ${
                      actionStatus === 'overdue' ? 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/30' :
                      actionStatus === 'today' ? 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/30' :
                      'text-muted'
                    }`}>
                      {lead.next_action_type && (
                        <span className="font-medium">{getActionTypeLabel(lead.next_action_type)} ·</span>
                      )}
                      <span>
                        {formatHumanDate(lead.next_action_at)}
                        {actionStatus === 'overdue' && ' · Vencido'}
                        {actionStatus === 'today' && ' · Hoy'}
                      </span>
                    </div>
                  ) : (
                    <div className="text-muted">Sin próxima acción programada</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
