import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { pipelineApi } from '../features/pipeline/pipeline.api'
import { generateIdempotencyKey } from '../features/pipeline/pipeline.store'
import {
  normalizeFocusItem,
  countByStatus,
  sortByPriority,
  filterByStatus,
  filterBySearch,
  formatDate,
  type FocusItem,
} from '../shared/utils/focusHelpers'
import { LeadCard } from '../shared/components/LeadCard'

type StatusFilter = 'all' | 'overdue' | 'warn' | 'ok'

type Stage = {
  id: string
  name: string
  position: number
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
    return formatDate(dateString)
  } catch {
    return formatDate(dateString)
  }
}

function getSlaBadgeClass(status: FocusItem['sla_status']): string {
  if (status === 'breach') return 'badge badge-overdue'
  if (status === 'warn') return 'badge badge-warn'
  if (status === 'ok') return 'badge badge-ok'
  return 'badge badge-none'
}

function getSlaBadgeLabel(status: FocusItem['sla_status']): string {
  if (!status || status === 'none') return 'Sin SLA'
  if (status === 'breach') return 'Vencido'
  if (status === 'warn') return 'Por vencer'
  if (status === 'ok') return 'En tiempo'
  return 'Sin SLA'
}

// Helper: Group items by sla_status
function groupByStatus(items: FocusItem[]): {
  overdue: FocusItem[]
  warn: FocusItem[]
  ok: FocusItem[]
  none: FocusItem[]
} {
  const groups = {
    overdue: [] as FocusItem[],
    warn: [] as FocusItem[],
    ok: [] as FocusItem[],
    none: [] as FocusItem[],
  }

  items.forEach((item) => {
    const status = item.sla_status
    if (status === 'breach') {
      groups.overdue.push(item)
    } else if (status === 'warn') {
      groups.warn.push(item)
    } else if (status === 'ok') {
      groups.ok.push(item)
    } else {
      groups.none.push(item)
    }
  })

  return groups
}

export function FocusPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<FocusItem[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchText, setSearchText] = useState('')

  // Stages for move action
  const [stages, setStages] = useState<Stage[]>([])
  const [stagesLoaded, setStagesLoaded] = useState(false)

  // Move stage state
  const [movingLeadId, setMovingLeadId] = useState<string | null>(null)
  const [selectedStageId, setSelectedStageId] = useState<Record<string, string>>({})

  // Ref to prevent race conditions
  const fetchingRef = useRef(false)
  const intervalRef = useRef<number | null>(null)

  const loadData = async (isRefresh = false) => {
    // Prevent concurrent fetches
    if (fetchingRef.current) return

    fetchingRef.current = true

    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      const { data, error: rpcError } = await supabase.rpc('get_today_focus', {
        p_limit: 100,
      })

      if (rpcError) throw rpcError

      const normalized = (data || []).map(normalizeFocusItem)
      setItems(normalized)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al cargar datos de focus'
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
      fetchingRef.current = false
    }
  }

  const loadStages = async () => {
    if (stagesLoaded) return

    try {
      const stagesData = await pipelineApi.getStages()
      setStages(
        stagesData.map((s) => ({
          id: s.id,
          name: s.name,
          position: s.position,
        }))
      )
      setStagesLoaded(true)
    } catch (err) {
      console.error('Error loading stages:', err)
    }
  }

  const handleMoveStage = async (leadId: string, item: FocusItem) => {
    if (!item.stage_id) return

    const toStageId = selectedStageId[leadId] || item.stage_id

    if (toStageId === item.stage_id) return

    setMovingLeadId(leadId)

    try {
      const idempotencyKey = generateIdempotencyKey(
        leadId,
        item.stage_id,
        toStageId
      )

      await pipelineApi.moveLeadStage(leadId, toStageId, idempotencyKey)

      // Refresh data
      await loadData(true)
    } catch (err) {
      console.error('Error moving stage:', err)
    } finally {
      setMovingLeadId(null)
    }
  }

  // Initial load
  useEffect(() => {
    loadData()
    loadStages()
  }, [])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      loadData(true)
    }, 60000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  // Refresh when document becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData(true)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const filteredItems = sortByPriority(
    filterBySearch(filterByStatus(items, statusFilter), searchText)
  )
  const counts = countByStatus(items)
  const groupedItems = groupByStatus(filteredItems)

  const handleRefresh = () => {
    loadData(true)
  }

  // Render table row
  const renderTableRow = (item: FocusItem) => {
    const isMoving = movingLeadId === item.lead_id
    const currentSelectedStage = selectedStageId[item.lead_id] || item.stage_id || ''

    return (
      <tr
        key={item.lead_id}
        className="border-b border-border hover:bg-bg transition-colors"
      >
        <td className="py-2 px-3">
          <div className="flex flex-col">
            <span className="font-semibold text-sm text-text">
              {item.lead_name || `Lead ${item.lead_id.slice(0, 8)}...`}
            </span>
            {item.stage_name && (
              <span className="text-xs text-muted mt-0.5">{item.stage_name}</span>
            )}
          </div>
        </td>
        <td className="py-2 px-3">
          <div className={getSlaBadgeClass(item.sla_status)}>
            {getSlaBadgeLabel(item.sla_status)}
          </div>
        </td>
        <td className="py-2 px-3 text-xs text-muted">
          {item.sla_due_at ? formatHumanDate(item.sla_due_at) : '—'}
        </td>
        <td className="py-2 px-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => navigate(`/leads/${item.lead_id}`)}
              className="btn btn-primary text-xs px-2 py-1"
            >
              Abrir
            </button>
            <button
              onClick={() => navigate(`/pipeline?lead=${item.lead_id}`)}
              className="btn btn-ghost text-xs px-2 py-1"
            >
              Pipeline
            </button>
            {item.stage_id && stages.length > 0 && (
              <>
                <select
                  value={currentSelectedStage}
                  onChange={(e) =>
                    setSelectedStageId((prev) => ({
                      ...prev,
                      [item.lead_id]: e.target.value,
                    }))
                  }
                  disabled={isMoving}
                  className="select text-xs min-w-[100px]"
                >
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleMoveStage(item.lead_id, item)}
                  disabled={
                    isMoving ||
                    !currentSelectedStage ||
                    currentSelectedStage === item.stage_id
                  }
                  className="btn btn-primary text-xs px-2 py-1"
                >
                  {isMoving ? '...' : 'Mover'}
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
    )
  }

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h2 className="text-xl font-semibold m-0">Qué hacer hoy</h2>
        </div>
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="card"
              style={{ height: '120px', background: 'var(--bg)' }}
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
          <h2 className="text-xl font-semibold m-0">Qué hacer hoy</h2>
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

  if (items.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <h2 className="text-xl font-semibold m-0">Qué hacer hoy</h2>
        </div>
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: '48px 24px',
          }}
        >
          <p style={{ margin: '0 0 16px 0', fontSize: '16px' }}>
            Aún no hay leads para enfocarte hoy.
          </p>
          <p className="text-muted" style={{ margin: '0 0 24px 0' }}>
            Configura SLAs en las etapas del pipeline para comenzar a recibir
            recomendaciones.
          </p>
          <button
            onClick={() => navigate('/pipeline/settings')}
            className="btn btn-primary"
          >
            Configurar SLA
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-xl font-semibold m-0">Qué hacer hoy</h2>
        <div className="flex items-center gap-2">
          {refreshing && (
            <span className="text-xs text-muted">Actualizando...</span>
          )}
          <button onClick={handleRefresh} className="btn btn-ghost text-sm">
            Actualizar
          </button>
        </div>
      </div>

      {/* Counters */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <div className="card flex-1 min-w-[80px] p-2.5">
          <div className="text-xs text-muted mb-1">Total</div>
          <div className="text-2xl font-black">{counts.total}</div>
        </div>
        <div className="card flex-1 min-w-[80px] p-2.5">
          <div className="text-xs text-muted mb-1">Vencidos</div>
          <div className="text-2xl font-black text-danger">{counts.overdue}</div>
        </div>
        <div className="card flex-1 min-w-[80px] p-2.5">
          <div className="text-xs text-muted mb-1">Por vencer</div>
          <div className="text-2xl font-black text-warning">{counts.warn}</div>
        </div>
        <div className="card flex-1 min-w-[80px] p-2.5">
          <div className="text-xs text-muted mb-1">En tiempo</div>
          <div className="text-2xl font-black text-success">{counts.ok}</div>
        </div>
        <div className="card flex-1 min-w-[80px] p-2.5">
          <div className="text-xs text-muted mb-1">Sin SLA</div>
          <div className="text-2xl font-black">{counts.none}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-5 p-3">
        <div className="flex flex-col gap-3">
          {/* Status Tabs */}
          <div className="flex gap-1 flex-wrap">
            {(['all', 'overdue', 'warn', 'ok'] as StatusFilter[]).map(
              (filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === filter
                      ? 'bg-primary text-surface'
                      : 'bg-transparent text-text hover:bg-black/5'
                  }`}
                >
                  {filter === 'all'
                    ? 'Todos'
                    : filter === 'overdue'
                      ? 'Vencidos'
                      : filter === 'warn'
                        ? 'Por vencer'
                        : 'En tiempo'}
                </button>
              )
            )}
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full text-sm border border-border rounded-md px-3 py-2"
          />
        </div>
      </div>

      {/* Content: Table (Desktop) / Cards (Mobile) */}
      {filteredItems.length === 0 ? (
        <div className="card text-center p-6">
          <p className="text-muted">No hay resultados para los filtros seleccionados.</p>
        </div>
      ) : (
        <>
          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block">
            <div className="card p-0 overflow-x-auto">
              <table className="w-full">
                <thead className="bg-bg sticky top-0 z-10">
                  <tr className="border-b-2 border-border">
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted uppercase tracking-wide">
                      Lead
                    </th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted uppercase tracking-wide">
                      SLA
                    </th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted uppercase tracking-wide">
                      Vence
                    </th>
                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted uppercase tracking-wide">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(renderTableRow)}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards View (< md) */}
          <div className="md:hidden flex flex-col gap-5">
            {/* Overdue Section */}
            {groupedItems.overdue.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2.5 text-danger">
                  Vencidos ({groupedItems.overdue.length})
                </h3>
                <div className="flex flex-col gap-2.5">
                  {groupedItems.overdue.map((item) => (
                    <LeadCard
                      key={item.lead_id}
                      leadId={item.lead_id}
                      leadName={item.lead_name}
                      stageId={item.stage_id}
                      stageName={item.stage_name}
                      slaStatus={item.sla_status}
                      slaDaysLeft={item.sla_days_left}
                      slaDueAt={item.sla_due_at}
                      daysInStage={item.days_in_stage}
                      stages={stages}
                      onMoveSuccess={handleRefresh}
                      compact
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Warn Section */}
            {groupedItems.warn.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2.5 text-warning">
                  Por vencer ({groupedItems.warn.length})
                </h3>
                <div className="flex flex-col gap-2.5">
                  {groupedItems.warn.map((item) => (
                    <LeadCard
                      key={item.lead_id}
                      leadId={item.lead_id}
                      leadName={item.lead_name}
                      stageId={item.stage_id}
                      stageName={item.stage_name}
                      slaStatus={item.sla_status}
                      slaDaysLeft={item.sla_days_left}
                      slaDueAt={item.sla_due_at}
                      daysInStage={item.days_in_stage}
                      stages={stages}
                      onMoveSuccess={handleRefresh}
                      compact
                    />
                  ))}
                </div>
              </div>
            )}

            {/* OK Section */}
            {groupedItems.ok.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2.5 text-success">
                  En tiempo ({groupedItems.ok.length})
                </h3>
                <div className="flex flex-col gap-2.5">
                  {groupedItems.ok.map((item) => (
                    <LeadCard
                      key={item.lead_id}
                      leadId={item.lead_id}
                      leadName={item.lead_name}
                      stageId={item.stage_id}
                      stageName={item.stage_name}
                      slaStatus={item.sla_status}
                      slaDaysLeft={item.sla_days_left}
                      slaDueAt={item.sla_due_at}
                      daysInStage={item.days_in_stage}
                      stages={stages}
                      onMoveSuccess={handleRefresh}
                      compact
                    />
                  ))}
                </div>
              </div>
            )}

            {/* None Section */}
            {groupedItems.none.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2.5">
                  Sin SLA ({groupedItems.none.length})
                </h3>
                <div className="flex flex-col gap-2.5">
                  {groupedItems.none.map((item) => (
                    <LeadCard
                      key={item.lead_id}
                      leadId={item.lead_id}
                      leadName={item.lead_name}
                      stageId={item.stage_id}
                      stageName={item.stage_name}
                      slaStatus={item.sla_status}
                      slaDaysLeft={item.sla_days_left}
                      slaDueAt={item.sla_due_at}
                      daysInStage={item.days_in_stage}
                      stages={stages}
                      onMoveSuccess={handleRefresh}
                      compact
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
