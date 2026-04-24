import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { calendarApi } from '../api/calendar.api'
import type { CalendarEvent } from '../types/calendar.types'
import { getTypePillClass, getStatusPillClass, getTypeLabel, getStatusLabel } from '../utils/pillStyles'

/** Misma tipografía que las secciones en LeadDetailPage (Datos, Actividad, …). */
const SECTION_LABEL =
  'text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400'

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
  /** Si está definido, «Agendar» abre este flujo (p. ej. modal en LeadDetail) en lugar de ir al calendario. */
  onRequestNewAppointment?: () => void
}

const rowClass =
  'flex items-center gap-2 rounded-lg border border-neutral-200/90 bg-neutral-50/80 px-2.5 py-2 dark:border-neutral-700/70 dark:bg-neutral-900/35'

/**
 * Lista de citas del lead en modo solo lectura.
 * «Ver en Calendario» abre /calendar sin query (no dispara modal de nueva cita).
 * Opcionalmente `onRequestNewAppointment` permite agendar en contexto (p. ej. LeadDetail).
 */
export function LeadAppointmentsList({ leadId, onRequestNewAppointment }: LeadAppointmentsListProps) {
  const navigate = useNavigate()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [historyOpen, setHistoryOpen] = useState(false)
  /** Marca temporal para partir próximas vs historial sin llamar Date.now() en cada render. */
  const [asOfMs, setAsOfMs] = useState(() => Date.now())

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

  useEffect(() => {
    if (!loading) setAsOfMs(Date.now())
  }, [loading, events])

  const { upcoming, history } = useMemo(() => {
    const now = asOfMs
    return {
      upcoming: events.filter(
        (e) => new Date(e.starts_at).getTime() >= now && e.status === 'scheduled'
      ),
      history: events.filter(
        (e) => new Date(e.starts_at).getTime() < now || e.status !== 'scheduled'
      ),
    }
  }, [events, asOfMs])

  const goToCalendar = () => {
    navigate('/calendar')
  }

  const handleAgendar = () => {
    if (onRequestNewAppointment) {
      onRequestNewAppointment()
      return
    }
    goToCalendar()
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-neutral-100 pb-2.5 dark:border-neutral-800/80">
        <h3 className={SECTION_LABEL}>Citas</h3>
        <button
          type="button"
          onClick={goToCalendar}
          className="shrink-0 text-xs font-medium text-neutral-600 underline-offset-2 hover:text-neutral-900 hover:underline dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          Ver en Calendario
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-10 rounded-lg bg-neutral-200/60 animate-pulse dark:bg-neutral-800/50" />
          <div className="h-10 rounded-lg bg-neutral-200/60 animate-pulse dark:bg-neutral-800/50" />
          <div className="h-8 w-3/4 rounded-lg bg-neutral-200/60 animate-pulse dark:bg-neutral-800/50" />
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Este lead no tiene citas.{' '}
            {onRequestNewAppointment
              ? 'Usa Agendar para crear una cita sin salir de esta pantalla, o abre el calendario completo.'
              : 'Las citas se gestionan desde el Calendario.'}
          </p>
          <button
            type="button"
            onClick={handleAgendar}
            className="btn btn-primary text-sm shrink-0 self-start sm:self-auto"
          >
            Agendar
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-2 mb-1">
            {upcoming.length === 0 ? (
              <div className="flex flex-col gap-2 py-0.5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-neutral-500 dark:text-neutral-400">Sin citas programadas</p>
                <button
                  type="button"
                  onClick={handleAgendar}
                  className="btn btn-primary text-sm shrink-0 self-start sm:self-auto"
                >
                  Agendar
                </button>
              </div>
            ) : (
              upcoming.map((ev) => (
                <div key={ev.id} className={rowClass}>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${getTypePillClass(ev.type)}`}
                  >
                    {getTypeLabel(ev.type)}
                  </span>
                  <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400 shrink-0">
                    {formatDateTimeLocal(ev.starts_at)}
                  </span>
                  <span className="text-sm text-neutral-800 dark:text-neutral-200 truncate min-w-0 flex-1">
                    {ev.title?.trim() || 'Sin título'}
                  </span>
                </div>
              ))
            )}
          </div>

          {history.length > 0 && (
            <div className="mt-1">
              <button
                type="button"
                onClick={() => setHistoryOpen((o) => !o)}
                className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border-0 bg-transparent py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
                aria-expanded={historyOpen}
              >
                <span className={SECTION_LABEL}>Historial</span>
                <span className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400" aria-hidden>
                  <span className="tabular-nums">({history.length})</span>
                  {historyOpen ? '▼' : '▶'}
                </span>
              </button>
              {historyOpen && (
                <div className="mt-2 space-y-2 border-t border-neutral-100 pt-3 dark:border-neutral-800/80">
                  {history.map((ev) => (
                    <div key={ev.id} className={rowClass}>
                      <span
                        className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${getTypePillClass(ev.type)}`}
                      >
                        {getTypeLabel(ev.type)}
                      </span>
                      <span className="text-xs tabular-nums text-neutral-500 dark:text-neutral-400 shrink-0">
                        {formatDateTimeLocal(ev.starts_at)}
                      </span>
                      {ev.status !== 'scheduled' ? (
                        <span
                          className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${getStatusPillClass(ev.status)}`}
                        >
                          {getStatusLabel(ev.status)}
                        </span>
                      ) : null}
                      <span className="text-sm text-neutral-800 dark:text-neutral-200 truncate min-w-0 flex-1">
                        {ev.title?.trim() || 'Sin título'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  )
}
