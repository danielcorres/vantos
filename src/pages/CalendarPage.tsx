import { useState, useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarWeekView } from '../features/calendar/components/CalendarWeekView'
import { UpcomingEventsList } from '../features/calendar/components/UpcomingEventsList'
import { AppointmentFormModal } from '../features/calendar/components/AppointmentFormModal'
import type { CalendarEvent } from '../features/calendar/types/calendar.types'
import type { AppointmentEditFocus } from '../features/calendar/components/AppointmentFormModal'
import {
  disconnectGoogleCalendar,
  getGoogleCalendarStatus,
  startGoogleCalendarOAuth,
} from '../features/calendar/api/googleCalendarEdge'
import { subscribeGoogleCalendarSyncErrors } from '../features/calendar/utils/googleCalendarSyncListeners'
import { GOOGLE_CALENDAR_INTEGRATION_ENABLED } from '../features/calendar/config/googleCalendarIntegrationEnabled'
import { formatGoogleCalendarReturnError } from '../features/calendar/utils/googleOAuthReturnMessages'
import { Toast } from '../shared/components/Toast'

type ViewMode = 'week' | 'upcoming'

function getMondayOf(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  const start = monday.toLocaleDateString('es-MX', opts)
  const end = sunday.toLocaleDateString('es-MX', opts)
  const year = monday.getFullYear()
  return `${start} – ${end}, ${year}`
}

export function CalendarPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [weekStart, setWeekStart] = useState(() => getMondayOf(new Date()))
  const [refreshKey, setRefreshKey] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [editFocus, setEditFocus] = useState<AppointmentEditFocus | null>(null)
  const [initialLeadId, setInitialLeadId] = useState<string | undefined>(undefined)
  const [googleBanner, setGoogleBanner] = useState<{
    connected: boolean
    google_email: string | null
  } | null>(null)
  const [googleBannerLoading, setGoogleBannerLoading] = useState(true)
  const [googleToast, setGoogleToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  const refreshGoogleStatus = useCallback(async () => {
    if (!GOOGLE_CALENDAR_INTEGRATION_ENABLED) {
      setGoogleBanner(null)
      setGoogleBannerLoading(false)
      return
    }
    setGoogleBannerLoading(true)
    try {
      const s = await getGoogleCalendarStatus()
      setGoogleBanner(s ?? { connected: false, google_email: null })
    } catch {
      setGoogleBanner({ connected: false, google_email: null })
    } finally {
      setGoogleBannerLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshGoogleStatus()
  }, [refreshGoogleStatus])

  useEffect(() => {
    const g = searchParams.get('google_calendar')
    if (!g) return
    if (GOOGLE_CALENDAR_INTEGRATION_ENABLED) {
      if (g === 'connected') {
        setGoogleToast({ type: 'success', message: 'Google Calendar conectado correctamente.' })
        void refreshGoogleStatus()
      } else if (g === 'error') {
        const reason = searchParams.get('reason')
        const detail = reason ? decodeURIComponent(reason.replace(/\+/g, ' ')) : ''
        setGoogleToast({
          type: 'error',
          message: formatGoogleCalendarReturnError(detail),
        })
      }
    }
    setSearchParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.delete('google_calendar')
        n.delete('reason')
        return n
      },
      { replace: true }
    )
  }, [searchParams, setSearchParams, refreshGoogleStatus])

  useEffect(() => {
    if (!GOOGLE_CALENDAR_INTEGRATION_ENABLED) return undefined
    return subscribeGoogleCalendarSyncErrors((msg) => {
      setGoogleToast({ type: 'error', message: msg })
    })
  }, [])

  // Abrir modal de creación pre-cargado con el lead de ?lead=
  useEffect(() => {
    const leadId = searchParams.get('lead')
    if (leadId) {
      setInitialLeadId(leadId)
      setModalMode('create')
      setEditingEvent(null)
      setEditFocus(null)
      setModalOpen(true)
    }
  }, [searchParams])

  // Hub semanal (y otros): ?new=1 abre nueva cita sin lead precargado; se quita el param para no reabrir al refrescar.
  // Si también hay ?lead=, gana el lead (mismo modal); solo limpiamos `new` de la URL.
  useEffect(() => {
    if (searchParams.get('new') !== '1') return
    const stripNew = () =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('new')
          return next
        },
        { replace: true }
      )
    if (searchParams.get('lead')) {
      stripNew()
      return
    }
    setInitialLeadId(undefined)
    setModalMode('create')
    setEditingEvent(null)
    setEditFocus(null)
    setModalOpen(true)
    stripNew()
  }, [searchParams, setSearchParams])

  const handleSaved = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const openCreate = () => {
    setInitialLeadId(undefined)
    setModalMode('create')
    setEditingEvent(null)
    setEditFocus(null)
    setModalOpen(true)
  }

  const openEdit = (event: CalendarEvent, focus?: AppointmentEditFocus) => {
    setInitialLeadId(undefined)
    setModalMode('edit')
    setEditingEvent(event)
    setEditFocus(focus ?? null)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingEvent(null)
    setEditFocus(null)
    setInitialLeadId(undefined)
  }

  const goToPrevWeek = () => {
    setWeekStart((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() - 7)
      return d
    })
  }

  const goToNextWeek = () => {
    setWeekStart((prev) => {
      const d = new Date(prev)
      d.setDate(d.getDate() + 7)
      return d
    })
  }

  const goToToday = () => {
    setWeekStart(getMondayOf(new Date()))
  }

  const isCurrentWeek = getMondayOf(new Date()).getTime() === weekStart.getTime()

  const handleConnectGoogle = async () => {
    const r = await startGoogleCalendarOAuth({ returnPath: '/calendar' })
    if (r.ok) {
      window.location.href = r.authUrl
      return
    }
    setGoogleToast({ type: 'error', message: r.message })
  }

  const handleDisconnectGoogle = async () => {
    const r = await disconnectGoogleCalendar()
    if (r.ok) {
      setGoogleToast({ type: 'success', message: 'Google Calendar desconectado.' })
      void refreshGoogleStatus()
    } else {
      setGoogleToast({ type: 'error', message: r.message })
    }
  }

  return (
    <div className="flex flex-col min-h-0">
      <header className="shrink-0 px-4 py-3 border-b border-border bg-surface/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="text-lg font-semibold text-text">Calendario</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className="inline-flex rounded-lg border border-border bg-bg p-0.5"
              role="tablist"
              aria-label="Vista"
            >
              <button
                role="tab"
                aria-selected={viewMode === 'week'}
                onClick={() => setViewMode('week')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  viewMode === 'week'
                    ? 'bg-white text-neutral-900 ring-1 ring-neutral-200 font-medium'
                    : 'text-neutral-600 hover:bg-neutral-200/60'
                }`}
              >
                Semana
              </button>
              <button
                role="tab"
                aria-selected={viewMode === 'upcoming'}
                onClick={() => setViewMode('upcoming')}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  viewMode === 'upcoming'
                    ? 'bg-white text-neutral-900 ring-1 ring-neutral-200 font-medium'
                    : 'text-neutral-600 hover:bg-neutral-200/60'
                }`}
              >
                Próximas
              </button>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors"
            >
              + Nueva cita
            </button>
          </div>
        </div>

        {GOOGLE_CALENDAR_INTEGRATION_ENABLED && !googleBannerLoading && googleBanner != null && (
          <div className="mt-3 rounded-lg border border-border bg-bg/80 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-text">
            <div className="min-w-0">
              {googleBanner.connected ? (
                <span className="text-neutral-700 dark:text-neutral-200">
                  Sincronización activa con Google Calendar
                  {googleBanner.google_email ? (
                    <span className="text-muted"> ({googleBanner.google_email})</span>
                  ) : null}
                  .
                </span>
              ) : (
                <span className="text-neutral-700 dark:text-neutral-200">
                  Opcional: al conectar, las citas nuevas o editadas se reflejan en tu Google Calendar.
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {googleBanner.connected ? (
                <button
                  type="button"
                  onClick={() => void handleDisconnectGoogle()}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-border text-text hover:bg-black/5"
                >
                  Desconectar Google
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleConnectGoogle()}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-50"
                >
                  Conectar Google Calendar
                </button>
              )}
            </div>
          </div>
        )}

        {/* Navegación de semana — solo visible en vista Semana */}
        {viewMode === 'week' && (
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={goToPrevWeek}
              aria-label="Semana anterior"
              className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            <span className="text-sm text-neutral-600 dark:text-neutral-400 min-w-[200px] text-center">
              {formatWeekLabel(weekStart)}
            </span>
            <button
              type="button"
              onClick={goToNextWeek}
              aria-label="Semana siguiente"
              className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
            {!isCurrentWeek && (
              <button
                type="button"
                onClick={goToToday}
                className="px-2.5 py-1 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
              >
                Hoy
              </button>
            )}
          </div>
        )}
      </header>

      <main className="flex-1 overflow-auto p-4">
        {viewMode === 'week' && (
          <CalendarWeekView
            weekStart={weekStart}
            onEventClick={openEdit}
            refreshKey={refreshKey}
          />
        )}
        {viewMode === 'upcoming' && (
          <UpcomingEventsList
            onEventClick={openEdit}
            refreshKey={refreshKey}
          />
        )}
      </main>

      <AppointmentFormModal
        key={
          modalMode === 'edit' && editingEvent
            ? `edit-${editingEvent.id}-${editFocus ?? 'none'}`
            : `create-${initialLeadId ?? 'open'}`
        }
        isOpen={modalOpen}
        onClose={closeModal}
        mode={modalMode}
        event={editingEvent}
        initialLeadId={initialLeadId}
        onSaved={handleSaved}
        initialEditFocus={modalMode === 'edit' ? editFocus : null}
      />

      {googleToast != null && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] max-w-md w-[calc(100%-2rem)]">
          <Toast
            type={googleToast.type}
            message={googleToast.message}
            onClose={() => setGoogleToast(null)}
            durationMs={3200}
          />
        </div>
      )}
    </div>
  )
}
