import { useState, useEffect, useCallback } from 'react'
import { calendarApi } from '../api/calendar.api'
import type { CalendarEvent, AppointmentType, AppointmentStatus } from '../types/calendar.types'
import { toDateTimeLocal, fromDateTimeLocal } from '../utils/dateTimeLocal'
import { getStatusPillClass, getTypeLabel, getStatusLabel } from '../utils/pillStyles'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'

const DURATION_OPTIONS = [30, 45, 60, 90] as const
const TYPE_OPTIONS: AppointmentType[] = ['first_meeting', 'closing', 'follow_up']
const STATUS_OPTIONS: AppointmentStatus[] = ['scheduled', 'completed', 'no_show', 'canceled']

type Mode = 'create' | 'edit'

export type CreateDefaults = {
  durationMinutes?: number
  startsAtOffsetHours?: number
  roundToMinutes?: number
}

interface AppointmentFormModalProps {
  isOpen: boolean
  onClose: () => void
  mode: Mode
  event?: CalendarEvent | null
  onSaved: () => void
  /** Al crear desde LeadDetail: prellenar lead_id y usar defaults (duración 30, inicio now+1h redondeado a 30 min). */
  initialLeadId?: string | null
  createDefaults?: CreateDefaults
  /** Bloquear tipo de cita (ej. flujo post-creación lead: first_meeting o closing). Oculta selector de tipo. */
  lockType?: AppointmentType | null
}

function computeEndsAt(startsAtValue: string, durationMinutes: number): string {
  if (!startsAtValue || startsAtValue.length < 16) return ''
  const start = new Date(startsAtValue).getTime()
  return new Date(start + durationMinutes * 60 * 1000).toISOString()
}

/** Ahora + offset horas, redondeado al próximo bloque de roundToMinutes (ej. 30). */
function getDefaultStartForLead(defaults?: CreateDefaults | null): Date {
  const d = new Date()
  const hours = defaults?.startsAtOffsetHours ?? 1
  d.setTime(d.getTime() + hours * 60 * 60 * 1000)
  const roundTo = defaults?.roundToMinutes ?? 30
  const m = d.getMinutes()
  if (m === 0 && roundTo === 30) return d
  if (m < roundTo) {
    d.setMinutes(roundTo, 0, 0)
  } else {
    d.setMinutes(0, 0, 0)
    d.setHours(d.getHours() + 1)
  }
  return d
}

export function AppointmentFormModal({
  isOpen,
  onClose,
  mode,
  event,
  onSaved,
  initialLeadId = null,
  createDefaults,
  lockType = null,
}: AppointmentFormModalProps) {
  const [type, setType] = useState<AppointmentType>('first_meeting')
  const effectiveType = lockType ?? type
  const [startsAtValue, setStartsAtValue] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [location, setLocation] = useState('')
  const [meetingLink, setMeetingLink] = useState('')
  const [status, setStatus] = useState<AppointmentStatus>('scheduled')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  const resetForm = useCallback(() => {
    setType('first_meeting')
    setStartsAtValue('')
    setDurationMinutes(60)
    setTitle('')
    setNotes('')
    setLocation('')
    setMeetingLink('')
    setStatus('scheduled')
    setError(null)
    setShowDeleteConfirm(false)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    if (mode === 'edit' && event) {
      setType(event.type)
      setStartsAtValue(toDateTimeLocal(event.starts_at))
      const start = new Date(event.starts_at).getTime()
      const end = new Date(event.ends_at).getTime()
      const mins = Math.round((end - start) / (60 * 1000))
      setDurationMinutes(DURATION_OPTIONS.includes(mins as 30) ? (mins as 30) : mins > 0 ? mins : 60)
      setTitle(event.title ?? '')
      setNotes(event.notes ?? '')
      setLocation(event.location ?? '')
      setMeetingLink(event.meeting_link ?? '')
      setStatus(event.status)
    } else if (mode === 'create') {
      setType(lockType ?? 'first_meeting')
      const duration = initialLeadId != null ? (createDefaults?.durationMinutes ?? 30) : 60
      setDurationMinutes(duration)
      setTitle('')
      setNotes('')
      setLocation('')
      setMeetingLink('')
      setStatus('scheduled')
      setError(null)
      setShowDeleteConfirm(false)
      const startDate =
        initialLeadId != null ? getDefaultStartForLead(createDefaults) : (() => { const n = new Date(); n.setMinutes(n.getMinutes() + 15); n.setSeconds(0, 0); return n })()
      setStartsAtValue(toDateTimeLocal(startDate.toISOString()))
    }
  }, [isOpen, mode, event, initialLeadId, createDefaults, lockType])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const starts_at = fromDateTimeLocal(startsAtValue)
    const ends_at = computeEndsAt(startsAtValue, durationMinutes)
    if (!starts_at || !ends_at) {
      setError('Fecha y hora de inicio son requeridas')
      return
    }
    if (new Date(starts_at).getTime() >= new Date(ends_at).getTime()) {
      setError('La hora de inicio debe ser anterior a la de fin')
      return
    }

    setLoading(true)
    setError(null)
    try {
      if (mode === 'create') {
        await calendarApi.createEvent({
          type: effectiveType,
          starts_at,
          ends_at,
          lead_id: initialLeadId ?? undefined,
          title: title.trim() || null,
          notes: notes.trim() || null,
          location: location.trim() || null,
          meeting_link: meetingLink.trim() || null,
        })
      } else if (event) {
        await calendarApi.updateEvent(event.id, {
          type: effectiveType,
          starts_at,
          ends_at,
          title: title.trim() || null,
          notes: notes.trim() || null,
          location: location.trim() || null,
          meeting_link: meetingLink.trim() || null,
          status,
        })
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!event || mode !== 'edit') return
    setLoading(true)
    setError(null)
    try {
      await calendarApi.deleteEvent(event.id)
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar')
    } finally {
      setLoading(false)
      setShowDeleteConfirm(false)
    }
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={handleClose}
      style={{ animation: prefersReducedMotion ? 'none' : 'fadeIn 150ms ease-out' }}
    >
      <div
        className="bg-bg border border-border rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text">
            {mode === 'create' ? 'Nueva cita' : 'Editar cita'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm p-3">
              {error}
            </div>
          )}

          {lockType == null && (
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AppointmentType)}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {getTypeLabel(t)}
                  </option>
                ))}
              </select>
            </div>
          )}
          {lockType != null && (
            <div>
              <span className="block text-xs font-medium text-muted mb-1">Tipo</span>
              <span className="text-sm font-medium text-text">{getTypeLabel(lockType)}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Inicio</label>
            <input
              type="datetime-local"
              value={startsAtValue}
              onChange={(e) => setStartsAtValue(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Duración (min)</label>
            <select
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
            >
              {DURATION_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Título (opcional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Reunión con cliente"
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
            />
          </div>

          {mode === 'edit' && (
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Estado</label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${getStatusPillClass(s)} ${
                      status === s ? 'ring-1 ring-offset-1 ring-current' : 'opacity-80 hover:opacity-100'
                    }`}
                  >
                    {getStatusLabel(s)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Ubicación (opcional)</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Link (opcional)</label>
            <input
              type="url"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            {mode === 'edit' && !showDeleteConfirm && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Eliminar
              </button>
            )}
            {mode === 'edit' && showDeleteConfirm && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">¿Eliminar?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                >
                  Sí
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 text-sm font-medium text-muted hover:bg-black/5 rounded-lg"
                >
                  No
                </button>
              </div>
            )}
            <div className="flex-1 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-muted hover:bg-black/5 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 transition-colors"
              >
                {loading ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
