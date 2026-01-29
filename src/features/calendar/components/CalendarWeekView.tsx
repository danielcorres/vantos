import { useState, useEffect } from 'react'
import { calendarApi } from '../api/calendar.api'
import type { CalendarEvent } from '../types/calendar.types'
import { getWeekRangeFromDate } from '../utils/weekRange'
import { getTypePillClass, getTypeLabel } from '../utils/pillStyles'

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

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

interface CalendarWeekViewProps {
  weekStart: Date
  onEventClick: (event: CalendarEvent) => void
  refreshKey?: number
}

export function CalendarWeekView({ weekStart, onEventClick, refreshKey = 0 }: CalendarWeekViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const eventsByDay = (() => {
    const map: Record<string, CalendarEvent[]> = {}
    const start = new Date(weekStart)
    const day = start.getDay()
    const diff = day === 0 ? -6 : 1 - day
    start.setDate(start.getDate() + diff)
    start.setHours(0, 0, 0, 0)
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
  })()

  const weekDays = (() => {
    const start = new Date(weekStart)
    const day = start.getDay()
    const diff = day === 0 ? -6 : 1 - day
    start.setDate(start.getDate() + diff)
    start.setHours(0, 0, 0, 0)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return { date: d, key: ymd(d.toISOString()), dayName: DAY_NAMES[i], dayNum: d.getDate() }
    })
  })()

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
              (eventsByDay[key] ?? []).map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => onEventClick(ev)}
                  className="w-full text-left rounded-md px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center gap-2 flex-wrap"
                >
                  <span className="text-xs font-medium tabular-nums text-muted shrink-0">
                    {formatTime(ev.starts_at)}
                  </span>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${getTypePillClass(ev.type)}`}>
                    {getTypeLabel(ev.type)}
                  </span>
                  <span className="text-sm text-text truncate">
                    {ev.title?.trim() || 'Sin título'}
                  </span>
                  {ev.lead_id && (
                    <span className="text-xs text-muted shrink-0">{shortLeadId(ev.lead_id)}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
