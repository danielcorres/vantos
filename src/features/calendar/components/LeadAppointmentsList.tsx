import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { calendarApi } from '../api/calendar.api'
import type { CalendarEvent } from '../types/calendar.types'
import { AppointmentFormModal, type CreateDefaults } from './AppointmentFormModal'
import { getTypePillClass, getStatusPillClass, getTypeLabel, getStatusLabel } from '../utils/pillStyles'

const CREATE_DEFAULTS_LEAD: CreateDefaults = {
  durationMinutes: 30,
  startsAtOffsetHours: 1,
  roundToMinutes: 30,
}

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
  /** Slug de la etapa actual del lead (para CTA: citas_cierre → "Agendar cita de cierre") */
  currentStageSlug?: string | null
}

export function LeadAppointmentsList({ leadId, leadLabel: _leadLabel, currentStageSlug }: LeadAppointmentsListProps) {
  const navigate = useNavigate()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [createLockType, setCreateLockType] = useState<'first_meeting' | 'closing' | null>(null)
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
  }, [load, refreshKey])

  const now = Date.now()
  const upcoming = events.filter(
    (e) => new Date(e.starts_at).getTime() >= now && e.status === 'scheduled'
  )
  const hasClosingScheduled = upcoming.some((e) => e.type === 'closing')
  const history = events.filter(
    (e) => new Date(e.starts_at).getTime() < now || e.status !== 'scheduled'
  )

  const primaryCtaType: 'first_meeting' | 'closing' | null =
    upcoming.length === 0
      ? 'first_meeting'
      : currentStageSlug === 'citas_cierre' && !hasClosingScheduled
        ? 'closing'
        : null

  const handleSaved = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  const openCreate = (lockType?: 'first_meeting' | 'closing') => {
    setModalMode('create')
    setEditingEvent(null)
    setCreateLockType(lockType ?? null)
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

  const goToCalendar = () => {
    navigate(`/calendar?lead=${encodeURIComponent(leadId)}`)
  }

  return (
    <div className="rounded-lg border border-border bg-bg/30 p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-medium text-muted">Citas</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openCreate()}
            className="text-xs font-medium text-primary hover:underline"
          >
            + Agregar cita
          </button>
          <span className="text-border">|</span>
          <button
            type="button"
            onClick={goToCalendar}
            className="text-xs text-muted hover:text-text"
          >
            Ver en Calendario
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-10 rounded bg-black/5 animate-pulse" />
          <div className="h-10 rounded bg-black/5 animate-pulse" />
          <div className="h-8 rounded bg-black/5 animate-pulse w-3/4" />
        </div>
      ) : (
        <>
          {primaryCtaType && (
            <div className="mb-3">
              <button
                type="button"
                onClick={() => openCreate(primaryCtaType)}
                className="w-full px-3 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
              >
                {primaryCtaType === 'first_meeting' ? 'Agendar primera cita' : 'Agendar cita de cierre'}
              </button>
            </div>
          )}
          {/* Próximas */}
          <div className="space-y-1.5 mb-4">
            {upcoming.length === 0 ? (
              !primaryCtaType ? (
                <p className="text-xs text-muted py-1">Sin citas programadas</p>
              ) : null
            ) : (
              upcoming.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between gap-2 py-1.5 px-2 rounded border border-border/60 bg-bg/50"
                >
                  <div className="min-w-0 flex items-center gap-2 flex-wrap">
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${getTypePillClass(ev.type)}`}>
                      {getTypeLabel(ev.type)}
                    </span>
                    <span className="text-xs tabular-nums text-muted shrink-0">
                      {formatDateTimeLocal(ev.starts_at)}
                    </span>
                    <span className="text-sm text-text truncate">
                      {ev.title?.trim() || 'Sin título'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(ev)}
                      className="text-xs px-2 py-0.5 rounded border border-border hover:bg-black/5"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              )))}
          </div>

          {/* Historial: colapsable (default collapsed en mobile) */}
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
                      className="flex items-center justify-between gap-2 py-1.5 px-2 rounded border border-border/60 bg-bg/30"
                    >
                      <div className="min-w-0 flex items-center gap-2 flex-wrap">
                        <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${getTypePillClass(ev.type)}`}>
                          {getTypeLabel(ev.type)}
                        </span>
                        <span className="text-xs tabular-nums text-muted shrink-0">
                          {formatDateTimeLocal(ev.starts_at)}
                        </span>
                        <span className="text-sm text-text truncate">
                          {ev.title?.trim() || 'Sin título'}
                        </span>
                        {ev.status !== 'scheduled' && (
                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${getStatusPillClass(ev.status)}`}>
                            {getStatusLabel(ev.status)}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => openEdit(ev)}
                        className="text-xs px-2 py-0.5 rounded border border-border hover:bg-black/5 shrink-0"
                      >
                        Editar
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <AppointmentFormModal
        isOpen={modalOpen}
        onClose={() => {
          setCreateLockType(null)
          closeModal()
        }}
        mode={modalMode}
        event={editingEvent}
        onSaved={handleSaved}
        initialLeadId={modalMode === 'create' ? leadId : null}
        createDefaults={modalMode === 'create' ? CREATE_DEFAULTS_LEAD : undefined}
        lockType={modalMode === 'create' ? createLockType ?? undefined : undefined}
      />
    </div>
  )
}
