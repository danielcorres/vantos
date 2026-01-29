import { useState, useEffect } from 'react'
import { calendarApi } from '../api/calendar.api'
import type { CalendarEvent } from '../types/calendar.types'
import { getTypePillClass, getStatusPillClass, getTypeLabel, getStatusLabel } from '../utils/pillStyles'
import { todayLocalYmd, addDaysYmd } from '../../../shared/utils/dates'

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

type GroupKey = 'hoy' | 'manana' | 'esta_semana' | 'despues'

function getGroupKey(ev: CalendarEvent): GroupKey {
  const today = todayLocalYmd()
  const evYmd = ymd(ev.starts_at)
  if (evYmd === today) return 'hoy'
  const tomorrowYmd = addDaysYmd(today, 1)
  if (evYmd === tomorrowYmd) return 'manana'
  const [y, m, d] = today.split('-').map(Number)
  const endOfWeek = new Date(y, m - 1, d)
  const day = endOfWeek.getDay()
  const diff = day === 0 ? 0 : 7 - day
  endOfWeek.setDate(endOfWeek.getDate() + diff)
  const endYmd = `${endOfWeek.getFullYear()}-${String(endOfWeek.getMonth() + 1).padStart(2, '0')}-${String(endOfWeek.getDate()).padStart(2, '0')}`
  if (evYmd <= endYmd) return 'esta_semana'
  return 'despues'
}

const GROUP_LABEL: Record<GroupKey, string> = {
  hoy: 'Hoy',
  manana: 'Mañana',
  esta_semana: 'Esta semana',
  despues: 'Después',
}

interface UpcomingEventsListProps {
  onEventClick: (event: CalendarEvent) => void
  refreshKey?: number
}

export function UpcomingEventsList({ onEventClick, refreshKey = 0 }: UpcomingEventsListProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    calendarApi
      .listUpcomingEvents({ limit: 50 })
      .then(setEvents)
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar'))
      .finally(() => setLoading(false))
  }, [refreshKey])

  const grouped = (() => {
    const order: GroupKey[] = ['hoy', 'manana', 'esta_semana', 'despues']
    const map: Record<GroupKey, CalendarEvent[]> = {
      hoy: [],
      manana: [],
      esta_semana: [],
      despues: [],
    }
    for (const ev of events) {
      const key = getGroupKey(ev)
      map[key].push(ev)
    }
    return order.map((key) => ({ key, label: GROUP_LABEL[key], items: map[key] })).filter((g) => g.items.length > 0)
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
        Cargando próximas…
      </div>
    )
  }

  if (events.length === 0) {
    return (
      <div className="py-8 text-center text-muted text-sm">
        No hay eventos programados
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {grouped.map(({ key, label, items }) => (
        <div key={key}>
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            {label}
          </h3>
          <ul className="space-y-1.5">
            {items.map((ev) => (
              <li key={ev.id}>
                <button
                  type="button"
                  onClick={() => onEventClick(ev)}
                  className="w-full text-left rounded-lg border border-border bg-bg/50 px-3 py-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex flex-wrap items-center gap-2"
                >
                  <span className="text-xs font-medium tabular-nums text-muted shrink-0">
                    {formatTime(ev.starts_at)}
                  </span>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${getTypePillClass(ev.type)}`}>
                    {getTypeLabel(ev.type)}
                  </span>
                  {ev.status !== 'scheduled' && (
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${getStatusPillClass(ev.status)}`}>
                      {getStatusLabel(ev.status)}
                    </span>
                  )}
                  <span className="text-sm text-text truncate min-w-0">
                    {ev.title?.trim() || 'Sin título'}
                  </span>
                  {ev.lead_id && (
                    <span className="text-xs text-muted shrink-0">{shortLeadId(ev.lead_id)}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
