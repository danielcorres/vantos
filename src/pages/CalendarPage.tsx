import { useState, useCallback } from 'react'
import { CalendarWeekView } from '../features/calendar/components/CalendarWeekView'
import { UpcomingEventsList } from '../features/calendar/components/UpcomingEventsList'
import { AppointmentFormModal } from '../features/calendar/components/AppointmentFormModal'
import type { CalendarEvent } from '../features/calendar/types/calendar.types'

type ViewMode = 'week' | 'upcoming'

export function CalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [weekStart] = useState(() => new Date())
  const [refreshKey, setRefreshKey] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)

  const handleSaved = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const openCreate = () => {
    setModalMode('create')
    setEditingEvent(null)
    setModalOpen(true)
  }

  const openEdit = (event: CalendarEvent) => {
    setModalMode('edit')
    setEditingEvent(event)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingEvent(null)
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
        isOpen={modalOpen}
        onClose={closeModal}
        mode={modalMode}
        event={editingEvent}
        onSaved={handleSaved}
      />
    </div>
  )
}
