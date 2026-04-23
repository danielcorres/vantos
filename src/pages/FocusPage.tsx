import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { pipelineApi, type Lead } from '../features/pipeline/pipeline.api'
import { calendarApi } from '../features/calendar/api/calendar.api'
import type { CalendarEvent } from '../features/calendar/types/calendar.types'
import { todayLocalYmd, addDaysYmd } from '../shared/utils/dates'

type StatusFilter = 'all' | 'overdue' | 'today' | 'future'

const APPOINTMENT_TYPE_LABELS: Record<string, string> = {
  call: 'Llamada',
  message: 'Mensaje',
  meeting: 'Reunión',
  other: 'Otro',
}

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

    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    const day = date.getDate()
    const month = months[date.getMonth()]
    return `${day} ${month}`
  } catch {
    return ''
  }
}

function getAppointmentTypeLabel(type: string | null | undefined): string {
  if (!type) return ''
  return APPOINTMENT_TYPE_LABELS[type] ?? type
}

/** Comparación por fecha local (YMD del ISO). */
function getStartsAtStatus(startsAt: string | null | undefined): 'overdue' | 'today' | 'future' | 'none' {
  if (!startsAt) return 'none'
  const today = todayLocalYmd()
  const ymd = startsAt.split('T')[0]
  if (ymd < today) return 'overdue'
  if (ymd === today) return 'today'
  return 'future'
}

type LeadNextAppointmentRow = {
  lead: Lead
  event: CalendarEvent
}

function sortRows(rows: LeadNextAppointmentRow[]): LeadNextAppointmentRow[] {
  return [...rows].sort((a, b) => {
    const ta = new Date(a.event.starts_at).getTime()
    const tb = new Date(b.event.starts_at).getTime()
    if (ta !== tb) return ta - tb
    return (a.lead.full_name || '').localeCompare(b.lead.full_name || '')
  })
}

function filterRowsByStatus(rows: LeadNextAppointmentRow[], status: StatusFilter): LeadNextAppointmentRow[] {
  if (status === 'all') return rows
  return rows.filter((row) => {
    const s = getStartsAtStatus(row.event.starts_at)
    if (status === 'overdue') return s === 'overdue'
    if (status === 'today') return s === 'today'
    if (status === 'future') return s === 'future'
    return false
  })
}

function filterRowsBySearch(rows: LeadNextAppointmentRow[], searchText: string): LeadNextAppointmentRow[] {
  if (!searchText.trim()) return rows
  const q = searchText.toLowerCase()
  return rows.filter(({ lead }) => {
    const name = (lead.full_name || '').toLowerCase()
    const source = (lead.source || '').toLowerCase()
    return name.includes(q) || source.includes(q)
  })
}

/** Próxima cita programada por lead (la más próxima en el tiempo). */
function pickNextEventPerLead(events: CalendarEvent[]): CalendarEvent[] {
  const withLead = events.filter((e): e is CalendarEvent & { lead_id: string } => Boolean(e.lead_id))
  const byLead = new Map<string, CalendarEvent>()
  for (const ev of withLead) {
    const cur = byLead.get(ev.lead_id)
    if (!cur || new Date(ev.starts_at) < new Date(cur.starts_at)) {
      byLead.set(ev.lead_id, ev)
    }
  }
  return [...byLead.values()].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
}

export function FocusPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<LeadNextAppointmentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchText, setSearchText] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const fromPast = new Date()
      fromPast.setDate(fromPast.getDate() - 60)
      const events = await calendarApi.listUpcomingEvents({
        from: fromPast.toISOString(),
        limit: 300,
      })
      const nextPerLead = pickNextEventPerLead(events)
      const leadIds = nextPerLead.map((e) => e.lead_id as string)
      const leads = await pipelineApi.getLeadsByIds(leadIds)
      const leadById = new Map(leads.map((l) => [l.id, l]))
      const built: LeadNextAppointmentRow[] = []
      for (const ev of nextPerLead) {
        const lead = leadById.get(ev.lead_id as string)
        if (lead) built.push({ lead, event: ev })
      }
      setRows(sortRows(built))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const filteredRows = useMemo(() => {
    let list = filterRowsBySearch(rows, searchText)
    list = filterRowsByStatus(list, statusFilter)
    return sortRows(list)
  }, [rows, searchText, statusFilter])

  const counts = useMemo(() => {
    const overdue = rows.filter((r) => getStartsAtStatus(r.event.starts_at) === 'overdue').length
    const today = rows.filter((r) => getStartsAtStatus(r.event.starts_at) === 'today').length
    const future = rows.filter((r) => getStartsAtStatus(r.event.starts_at) === 'future').length
    return { total: rows.length, overdue, today, future }
  }, [rows])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">Qué hacer hoy</h1>
            <p className="text-sm text-muted">Próximas citas en el calendario</p>
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
            <p className="text-sm text-muted">Próximas citas en el calendario</p>
          </div>
        </div>
        <div className="card p-4 bg-red-50 border border-red-200">
          <p className="text-sm text-red-700 mb-3">{error}</p>
          <button type="button" onClick={() => void loadData()} className="btn btn-primary text-sm">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">Qué hacer hoy</h1>
            <p className="text-sm text-muted">Próximas citas en el calendario</p>
          </div>
        </div>
        <div className="card text-center p-12">
          <p className="mb-4 text-base">No hay citas programadas con lead asociado.</p>
          <p className="text-muted mb-6">Crea citas desde el pipeline o el calendario.</p>
          <button type="button" onClick={() => navigate('/calendar')} className="btn btn-primary mr-2">
            Ir al calendario
          </button>
          <button type="button" onClick={() => navigate('/pipeline')} className="btn btn-ghost">
            Ir al Pipeline
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Qué hacer hoy</h1>
          <p className="text-sm text-muted">Próximas citas en el calendario</p>
        </div>
        <button type="button" onClick={() => void loadData()} className="btn btn-ghost text-sm">
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="card p-3">
          <div className="text-xs text-muted mb-1">Total</div>
          <div className="text-xl font-black">{counts.total}</div>
        </div>
        <div className="card p-3 bg-red-50 border border-red-200">
          <div className="text-xs text-red-700 mb-1">Atrasadas</div>
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
      </div>

      <div className="card p-3">
        <div className="flex flex-col gap-3">
          <div className="flex gap-1 flex-wrap">
            {(['all', 'overdue', 'today', 'future'] as StatusFilter[]).map((filter) => (
              <button
                key={filter}
                type="button"
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
                    ? 'Atrasadas'
                    : filter === 'today'
                      ? 'Hoy'
                      : 'Futuro'}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full text-sm border border-border rounded px-3 py-2 bg-bg text-text"
          />
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="card text-center p-6">
          <p className="text-muted">No hay resultados para los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRows.map(({ lead, event }) => {
            const st = getStartsAtStatus(event.starts_at)
            const statusClass =
              st === 'overdue'
                ? 'border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20'
                : st === 'today'
                  ? 'border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20'
                  : ''

            return (
              <div
                key={`${lead.id}-${event.id}`}
                className={`card p-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors ${statusClass}`}
                onClick={() => navigate(`/leads/${lead.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(`/leads/${lead.id}`)
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm mb-0.5">{lead.full_name}</div>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-muted">
                      {lead.source ? (
                        <span className="px-2 py-0.5 bg-black/5 dark:bg-white/10 rounded">{lead.source}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="space-y-1 text-xs">
                  <div
                    className={`flex items-center gap-1.5 px-2 py-1 rounded ${
                      st === 'overdue'
                        ? 'text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/30'
                        : st === 'today'
                          ? 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/30'
                          : 'text-muted'
                    }`}
                  >
                    <span className="font-medium">{getAppointmentTypeLabel(event.type)} ·</span>
                    <span>
                      {formatHumanDate(event.starts_at)}
                      {st === 'overdue' && ' · Atrasada'}
                      {st === 'today' && ' · Hoy'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
