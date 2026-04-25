import { useState, useEffect, useMemo, type KeyboardEvent } from 'react'
import { calendarApi } from '../api/calendar.api'
import type { CalendarEvent } from '../types/calendar.types'
import type { AppointmentEditFocus } from './AppointmentFormModal'
import { getWeekRangeFromDate } from '../utils/weekRange'
import { getTypePillClass, getTypeLabel, getStatusPillClass, getStatusLabel } from '../utils/pillStyles'

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export type CalendarWeekScope = 'weekdays' | 'full'

function formatTime(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function ymd(isoString: string): string {
  const d = new Date(isoString)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function shortLeadId(leadId: string | null): string {
  if (!leadId) return ''
  return leadId.slice(0, 8)
}

function mondayOfWeekContaining(date: Date): Date {
  const start = new Date(date)
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + diff)
  start.setHours(0, 0, 0, 0)
  return start
}

interface CalendarWeekViewProps {
  weekStart: Date
  onEventClick: (event: CalendarEvent, focus?: AppointmentEditFocus) => void
  refreshKey?: number
  /** Por defecto Lun–Vie; `full` muestra sábado y domingo. */
  weekScope?: CalendarWeekScope
}

function EventRowMobile({
  ev,
  onEventClick,
}: {
  ev: CalendarEvent
  onEventClick: (event: CalendarEvent, focus?: AppointmentEditFocus) => void
}) {
  return (
    <div
      role="group"
      aria-label="Cita"
      className="w-full rounded-md px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-2 flex-wrap"
    >
      <button
        type="button"
        title="Editar fecha y hora"
        onClick={() => onEventClick(ev, 'datetime')}
        className="inline-flex items-center gap-2 flex-wrap shrink-0 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <span className="text-xs font-medium tabular-nums text-muted shrink-0">{formatTime(ev.starts_at)}</span>
        <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${getTypePillClass(ev.type)}`}>
          {getTypeLabel(ev.type)}
        </span>
      </button>
      <button
        type="button"
        title="Cambiar estado"
        onClick={() => onEventClick(ev, 'status')}
        className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${getStatusPillClass(ev.status)}`}
      >
        {getStatusLabel(ev.status)}
      </button>
      <button
        type="button"
        title="Editar cita"
        onClick={() => onEventClick(ev)}
        className="min-w-0 flex-1 text-left text-sm text-text truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded px-0.5 -mx-0.5"
      >
        {ev.title?.trim() || 'Sin título'}
        {ev.lead_id ? <span className="text-xs text-muted shrink-0 ml-1">{shortLeadId(ev.lead_id)}</span> : null}
      </button>
    </div>
  )
}

function EventRowDesktop({
  ev,
  onEventClick,
}: {
  ev: CalendarEvent
  onEventClick: (event: CalendarEvent, focus?: AppointmentEditFocus) => void
}) {
  const titleText = ev.title?.trim() || 'Sin título'
  const openGeneral = () => onEventClick(ev)

  const handleCardKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openGeneral()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Editar cita: ${titleText}`}
      onClick={openGeneral}
      onKeyDown={handleCardKeyDown}
      className="w-full rounded-md border border-border/70 bg-surface p-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex flex-col gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <div className="flex flex-col items-stretch gap-2">
        <button
          type="button"
          title="Editar fecha y hora"
          onClick={(e) => {
            e.stopPropagation()
            onEventClick(ev, 'datetime')
          }}
          className="inline-flex items-center gap-2 flex-wrap shrink-0 self-start rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <span className="text-xs font-medium tabular-nums text-muted shrink-0">{formatTime(ev.starts_at)}</span>
          <span className={`shrink-0 px-2 py-1 rounded text-xs font-medium ${getTypePillClass(ev.type)}`}>
            {getTypeLabel(ev.type)}
          </span>
        </button>
        <button
          type="button"
          title="Cambiar estado"
          onClick={(e) => {
            e.stopPropagation()
            onEventClick(ev, 'status')
          }}
          className={`self-start px-2 py-1 rounded text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${getStatusPillClass(ev.status)}`}
        >
          {getStatusLabel(ev.status)}
        </button>
      </div>
      <p className="min-w-0 text-left text-xs font-medium text-text line-clamp-2 break-words pointer-events-none">
        {titleText}
        {ev.lead_id ? <span className="text-xs text-muted ml-1">{shortLeadId(ev.lead_id)}</span> : null}
      </p>
    </div>
  )
}

export function CalendarWeekView({
  weekStart,
  onEventClick,
  refreshKey = 0,
  weekScope = 'weekdays',
}: CalendarWeekViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const dayCount = weekScope === 'full' ? 7 : 5
  const gridColsClass = weekScope === 'full' ? 'md:grid-cols-7' : 'md:grid-cols-5'

  useEffect(() => {
    let cancelled = false
    const { from, to } = getWeekRangeFromDate(weekStart)
    setLoading(true)
    setError(null)
    calendarApi
      .listEventsInRange({ from, to })
      .then((data) => {
        if (!cancelled) setEvents(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error al cargar')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [weekStart, refreshKey])

  const monday = useMemo(() => mondayOfWeekContaining(weekStart), [weekStart])

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    const start = new Date(monday)
    for (let i = 0; i < 7; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      const key = ymd(d.toISOString())
      map[key] = []
    }
    for (const ev of events) {
      const key = ymd(ev.starts_at)
      if (map[key]) map[key].push(ev)
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    }
    return map
  }, [events, monday])

  const weekDays = useMemo(() => {
    const start = new Date(monday)
    return Array.from({ length: dayCount }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return { date: d, key: ymd(d.toISOString()), dayName: DAY_NAMES[i], dayNum: d.getDate() }
    })
  }, [monday, dayCount])

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm p-4">
        {error}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="py-8 text-center text-muted text-sm">
        Cargando semana…
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="md:hidden space-y-4">
        {weekDays.map(({ key, dayName, dayNum }) => (
          <div key={key} className="rounded-lg border border-border bg-bg/50 overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-surface/50 text-sm font-medium text-muted flex items-center gap-2">
              <span>{dayName}</span>
              <span className="text-text">{dayNum}</span>
            </div>
            <div className="p-2 space-y-1.5 min-h-[44px]">
              {(eventsByDay[key] ?? []).length === 0 ? (
                <p className="text-xs text-muted py-2 px-1">Sin eventos</p>
              ) : (
                (eventsByDay[key] ?? []).map((ev) => <EventRowMobile key={ev.id} ev={ev} onEventClick={onEventClick} />)
              )}
            </div>
          </div>
        ))}
      </div>
      <div className={`hidden md:grid gap-3 ${gridColsClass}`}>
        {weekDays.map(({ key, dayName, dayNum }) => (
          <div key={key} className="rounded-lg border border-border bg-bg/50 overflow-hidden min-h-[260px]">
            <div className="px-2.5 py-2 border-b border-border bg-surface/60 text-xs font-semibold text-muted flex items-center justify-between">
              <span>{dayName}</span>
              <span className="text-text">{dayNum}</span>
            </div>
            <div className="p-2 space-y-1.5">
              {(eventsByDay[key] ?? []).length === 0 ? (
                <p className="text-[11px] text-muted py-1">Sin eventos</p>
              ) : (
                (eventsByDay[key] ?? []).map((ev) => <EventRowDesktop key={ev.id} ev={ev} onEventClick={onEventClick} />)
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
