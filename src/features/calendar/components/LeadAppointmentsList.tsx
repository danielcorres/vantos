import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { calendarApi } from '../api/calendar.api'
import type { CalendarEvent } from '../types/calendar.types'
import { getTypePillClass, getStatusPillClass, getTypeLabel, getStatusLabel } from '../utils/pillStyles'

function formatDateTimeLocal(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleString('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface LeadAppointmentsListProps {
  leadId: string
  leadLabel?: string
}

/**
 * Lista de citas del lead en modo solo lectura.
 * Las citas se crean y editan desde el Calendario.
 */
export function LeadAppointmentsList({ leadId }: LeadAppointmentsListProps) {
  const navigate = useNavigate()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    calendarApi
      .listLeadEvents(leadId)
      .then(setEvents)
      .finally(() => setLoading(false))
  }, [leadId])

  useEffect(() => {
    load()
  }, [load])

  const now = Date.now()
  const upcoming = events.filter(
    (e) => new Date(e.starts_at).getTime() >= now && e.status === 'scheduled'
  )
  const history = events.filter(
    (e) => new Date(e.starts_at).getTime() < now || e.status !== 'scheduled'
  )

  const goToCalendar = () => {
    navigate(`/calendar?lead=${encodeURIComponent(leadId)}`)
  }

  return (
    <div className="rounded-lg border border-border bg-bg/30 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-medium text-muted">Citas</h3>
        <button
          type="button"
          onClick={goToCalendar}
          className="text-xs text-muted hover:text-text"
        >
          Ver en Calendario
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-10 rounded bg-black/5 animate-pulse" />
          <div className="h-10 rounded bg-black/5 animate-pulse" />
          <div className="h-8 rounded bg-black/5 animate-pulse w-3/4" />
        </div>
      ) : events.length === 0 ? (
        <p className="text-xs text-muted py-2">
          Este lead no tiene citas. Las citas se gestionan desde el Calendario.
        </p>
      ) : (
        <>
          {/* Próximas */}
          <div className="space-y-1.5 mb-4">
            {upcoming.length === 0 ? (
              <p className="text-xs text-muted py-1">Sin citas programadas</p>
            ) : (
              upcoming.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded border border-border/60 bg-bg/50"
                >
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${getTypePillClass(ev.type)}`}>
                    {getTypeLabel(ev.type)}
                  </span>
                  <span className="text-xs tabular-nums text-muted shrink-0">
                    {formatDateTimeLocal(ev.starts_at)}
                  </span>
                  <span className="text-sm text-text truncate min-w-0">
                    {ev.title?.trim() || 'Sin título'}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Historial: colapsable */}
          {history.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setHistoryOpen((o) => !o)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-text w-full py-1"
                aria-expanded={historyOpen}
              >
                <span aria-hidden>{historyOpen ? '▼' : '▶'}</span>
                Historial ({history.length})
              </button>
              {historyOpen && (
                <div className="mt-1.5 space-y-1.5 pl-3 border-l border-border">
                  {history.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-center gap-2 py-1.5 px-2 rounded border border-border/60 bg-bg/30"
                    >
                      <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${getTypePillClass(ev.type)}`}>
                        {getTypeLabel(ev.type)}
                      </span>
                      <span className="text-xs tabular-nums text-muted shrink-0">
                        {formatDateTimeLocal(ev.starts_at)}
                      </span>
                      <span className="text-sm text-text truncate min-w-0">
                        {ev.title?.trim() || 'Sin título'}
                      </span>
                      {ev.status !== 'scheduled' && (
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${getStatusPillClass(ev.status)}`}>
                          {getStatusLabel(ev.status)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
