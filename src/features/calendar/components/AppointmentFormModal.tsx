import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react'
import { calendarApi } from '../api/calendar.api'
import { pipelineApi, type Lead } from '../../pipeline/pipeline.api'
import type { CalendarEvent, AppointmentType, AppointmentStatus } from '../types/calendar.types'
import { APPOINTMENT_TYPES } from '../types/calendar.types'
import {
  toDateTimeLocal,
  fromDateTimeLocal,
  splitDateTimeLocal,
  joinDateTimeLocal,
} from '../utils/dateTimeLocal'
import { getStatusPillClass, getStatusLabel, getTypeLabel } from '../utils/pillStyles'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'
import { AppointmentLeadPicker } from './AppointmentLeadPicker'

const DURATION_OPTIONS = [30, 45, 60, 90] as const
const STATUS_OPTIONS: AppointmentStatus[] = ['scheduled', 'completed', 'no_show', 'canceled']

type Mode = 'create' | 'edit'

export type AppointmentEditFocus = 'datetime' | 'status'

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
  /** Bloquear tipo de cita (selector deshabilitado; se usa este valor). */
  lockType?: AppointmentType | null
  /** Inicio sugerido (ISO) al crear con lead; si es inválido se usa createDefaults / ahora+offset. */
  initialStartsAtIso?: string | null
  /** Tipo inicial sugerido (sin lockType). */
  initialAppointmentType?: AppointmentType | null
  /** Título inicial al crear (ej. seguimiento desde pipeline). */
  initialTitle?: string | null
  /** Texto de ayuda bajo el título (guía por etapa). */
  helpText?: string | null
  /** Solo edición: scroll y foco al abrir desde chips (fecha/hora vs estado). */
  initialEditFocus?: AppointmentEditFocus | null
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

const inputClass =
  'w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30'

export function AppointmentFormModal({
  isOpen,
  onClose,
  mode,
  event,
  onSaved,
  initialLeadId = null,
  createDefaults,
  lockType = null,
  initialStartsAtIso = null,
  initialAppointmentType = null,
  initialTitle = null,
  helpText = null,
  initialEditFocus = null,
}: AppointmentFormModalProps) {
  const dateTimeSectionRef = useRef<HTMLDivElement>(null)
  const dateInputRef = useRef<HTMLInputElement>(null)
  const statusSectionRef = useRef<HTMLDivElement>(null)
  const statusFirstButtonRef = useRef<HTMLButtonElement>(null)

  const [type, setType] = useState<AppointmentType>('meeting')
  const effectiveType = lockType ?? type
  const [startsAtValue, setStartsAtValue] = useState('')
  const [durationMinutes, setDurationMinutes] = useState(60)
  const [notesBody, setNotesBody] = useState('')
  const [status, setStatus] = useState<AppointmentStatus>('scheduled')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [markCitaRealizada, setMarkCitaRealizada] = useState(false)
  const [markPropuestaPresentada, setMarkPropuestaPresentada] = useState(false)
  const prefersReducedMotion = useReducedMotion()

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [clientDraft, setClientDraft] = useState('')
  const [phoneEdit, setPhoneEdit] = useState('')
  const [emailEdit, setEmailEdit] = useState('')

  const lockedLead = initialLeadId != null && initialLeadId !== ''

  const { date: datePart, time: timePart } = useMemo(() => splitDateTimeLocal(startsAtValue), [startsAtValue])

  const resetForm = useCallback(() => {
    setType('meeting')
    setStartsAtValue('')
    setDurationMinutes(60)
    setNotesBody('')
    setStatus('scheduled')
    setError(null)
    setShowDeleteConfirm(false)
    setMarkCitaRealizada(false)
    setMarkPropuestaPresentada(false)
    setSelectedLead(null)
    setClientDraft('')
    setPhoneEdit('')
    setEmailEdit('')
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
      setNotesBody(event.notes ?? '')
      setStatus(event.status)
      setMarkCitaRealizada(false)
      setMarkPropuestaPresentada(false)
      setClientDraft('')
      setSelectedLead(null)
      setPhoneEdit('')
      setEmailEdit('')
      if (event.lead_id) {
        let cancelled = false
        void pipelineApi.getLeadsByIds([event.lead_id]).then((rows) => {
          if (cancelled || rows.length === 0) return
          const L = rows[0]
          setSelectedLead(L)
          setPhoneEdit(L.phone ?? '')
          setEmailEdit(L.email ?? '')
        })
        return () => {
          cancelled = true
        }
      }
    } else if (mode === 'create') {
      setType(lockType ?? initialAppointmentType ?? 'meeting')
      const duration = initialLeadId != null ? (createDefaults?.durationMinutes ?? 30) : 60
      setDurationMinutes(duration)
      setNotesBody('')
      setStatus('scheduled')
      setError(null)
      setShowDeleteConfirm(false)
      setMarkCitaRealizada(false)
      setMarkPropuestaPresentada(false)
      setSelectedLead(null)
      setClientDraft('')
      setPhoneEdit('')
      setEmailEdit('')
      let startDate: Date
      if (initialLeadId != null) {
        const iso = initialStartsAtIso?.trim() ?? ''
        if (iso !== '') {
          const parsed = new Date(iso)
          startDate = Number.isNaN(parsed.getTime()) ? getDefaultStartForLead(createDefaults) : parsed
        } else {
          startDate = getDefaultStartForLead(createDefaults)
        }
      } else {
        const n = new Date()
        n.setMinutes(n.getMinutes() + 15)
        n.setSeconds(0, 0)
        startDate = n
      }
      setStartsAtValue(toDateTimeLocal(startDate.toISOString()))
    }
  }, [
    isOpen,
    mode,
    event,
    initialLeadId,
    createDefaults,
    lockType,
    initialStartsAtIso,
    initialAppointmentType,
  ])

  useEffect(() => {
    if (!isOpen || mode !== 'create' || !initialLeadId) return
    let cancelled = false
    void pipelineApi.getLeadsByIds([initialLeadId]).then((rows) => {
      if (cancelled || rows.length === 0) return
      const L = rows[0]
      setSelectedLead(L)
      setPhoneEdit(L.phone ?? '')
      setEmailEdit(L.email ?? '')
      setClientDraft('')
    })
    return () => {
      cancelled = true
    }
  }, [isOpen, mode, initialLeadId])

  useLayoutEffect(() => {
    if (!isOpen || mode !== 'edit' || !event || !initialEditFocus) return
    const behavior: ScrollBehavior = prefersReducedMotion ? 'auto' : 'smooth'
    let raf = 0
    let t1 = 0
    let t2 = 0
    raf = window.requestAnimationFrame(() => {
      t1 = window.setTimeout(() => {
        if (initialEditFocus === 'datetime') {
          dateTimeSectionRef.current?.scrollIntoView({ block: 'nearest', behavior })
          t2 = window.setTimeout(() => dateInputRef.current?.focus(), 0)
        } else {
          statusSectionRef.current?.scrollIntoView({ block: 'nearest', behavior })
          t2 = window.setTimeout(() => statusFirstButtonRef.current?.focus(), 0)
        }
      }, 50)
    })
    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [isOpen, mode, event?.id, initialEditFocus, prefersReducedMotion, event])

  const effectiveLeadId = selectedLead?.id ?? initialLeadId ?? null
  const hasLeadContactFields = !!selectedLead

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

    const resolvedTitle =
      (initialTitle?.trim() || '') ||
      (selectedLead ? selectedLead.full_name : clientDraft.trim()) ||
      null
    const notesOut = notesBody.trim() || null

    setLoading(true)
    setError(null)
    try {
      if (mode === 'create') {
        await calendarApi.createEvent({
          type: effectiveType,
          starts_at,
          ends_at,
          lead_id: effectiveLeadId != null && effectiveLeadId !== '' ? effectiveLeadId : undefined,
          title: resolvedTitle,
          notes: notesOut,
          location: null,
          meeting_link: null,
        })
        if (selectedLead) {
          const phone = phoneEdit.trim() || null
          const email = emailEdit.trim() || null
          if (phone !== (selectedLead.phone ?? null) || email !== (selectedLead.email ?? null)) {
            try {
              await pipelineApi.updateLead(selectedLead.id, { phone, email })
            } catch {
              /* no bloquear */
            }
          }
        }
      } else if (event) {
        await calendarApi.updateEvent(event.id, {
          type: effectiveType,
          starts_at,
          ends_at,
          title: event.title?.trim() || null,
          notes: notesOut,
          location: event.location?.trim() || null,
          meeting_link: event.meeting_link?.trim() || null,
          status,
        })
        const leadId = event.lead_id
        if (leadId && status === 'completed') {
          const nowIso = new Date().toISOString()
          const patch: { cita_realizada_at?: string; propuesta_presentada_at?: string } = {}
          if ((effectiveType === 'meeting' || effectiveType === 'call') && markCitaRealizada) {
            patch.cita_realizada_at = nowIso
          }
          if (effectiveType === 'meeting' && markPropuestaPresentada) patch.propuesta_presentada_at = nowIso
          if (Object.keys(patch).length > 0) {
            try {
              await pipelineApi.updateLead(leadId, patch)
            } catch {
              /* no bloquear */
            }
          }
        }
        if (leadId && selectedLead) {
          const phone = phoneEdit.trim() || null
          const email = emailEdit.trim() || null
          if (phone !== (selectedLead.phone ?? null) || email !== (selectedLead.email ?? null)) {
            try {
              await pipelineApi.updateLead(leadId, { phone, email })
            } catch {
              /* no bloquear */
            }
          }
        }
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

  const setDatePart = (v: string) => {
    setStartsAtValue(joinDateTimeLocal(v, timePart || '09:00'))
  }
  const setTimePart = (v: string) => {
    const d = datePart || splitDateTimeLocal(startsAtValue).date || new Date().toISOString().slice(0, 10)
    setStartsAtValue(joinDateTimeLocal(d, v || '09:00'))
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={handleClose}
      style={{ animation: prefersReducedMotion ? 'none' : 'fadeIn 150ms ease-out' }}
    >
      <div
        className="bg-bg border border-border rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-5 border-b border-border flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-text">
              {mode === 'create' ? 'Nueva cita' : 'Editar cita'}
            </h2>
            {helpText?.trim() ? (
              <p className="text-xs text-muted mt-1.5 leading-snug">{helpText.trim()}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="shrink-0 rounded-lg p-1.5 text-lg leading-none text-muted hover:bg-black/5 hover:text-text"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm p-3">
              {error}
            </div>
          )}

          {mode === 'create' && lockedLead && !selectedLead && (
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Cliente</label>
              <input
                type="text"
                readOnly
                value="Cargando…"
                className="w-full rounded-lg border border-border bg-neutral-50 dark:bg-neutral-900/40 px-3 py-2 text-sm text-muted"
              />
            </div>
          )}
          {mode === 'create' && !(lockedLead && !selectedLead) && (
            <AppointmentLeadPicker
              locked={lockedLead}
              draft={clientDraft}
              onDraftChange={setClientDraft}
              selectedLead={selectedLead}
              onSelectLead={(L) => {
                setSelectedLead(L)
                setPhoneEdit(L.phone ?? '')
                setEmailEdit(L.email ?? '')
              }}
              onClear={() => {
                setSelectedLead(null)
                setPhoneEdit('')
                setEmailEdit('')
              }}
            />
          )}

          {mode === 'edit' && event?.lead_id && !selectedLead && (
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Cliente</label>
              <input
                type="text"
                readOnly
                value="Cargando…"
                className="w-full rounded-lg border border-border bg-neutral-50 dark:bg-neutral-900/40 px-3 py-2 text-sm text-muted"
              />
            </div>
          )}
          {mode === 'edit' && event?.lead_id && selectedLead && (
            <AppointmentLeadPicker
              locked
              draft=""
              onDraftChange={() => {}}
              selectedLead={selectedLead}
              onSelectLead={() => {}}
              onClear={() => {}}
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Teléfono</label>
              <input
                type="tel"
                value={phoneEdit}
                onChange={(e) => setPhoneEdit(e.target.value)}
                placeholder="55 1234 5678"
                disabled={!hasLeadContactFields}
                className={`${inputClass} disabled:opacity-50 disabled:cursor-not-allowed`}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Email</label>
              <input
                type="email"
                value={emailEdit}
                onChange={(e) => setEmailEdit(e.target.value)}
                placeholder="cliente@email.com"
                disabled={!hasLeadContactFields}
                className={`${inputClass} disabled:opacity-50 disabled:cursor-not-allowed`}
              />
            </div>
          </div>
          {!hasLeadContactFields && mode === 'create' ? (
            <p className="text-xs text-muted -mt-2">Elige un cliente para editar teléfono y correo.</p>
          ) : null}

          <div ref={dateTimeSectionRef} className="space-y-3 scroll-mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Fecha</label>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={datePart}
                  onChange={(e) => setDatePart(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Hora</label>
                <input
                  type="time"
                  value={timePart}
                  onChange={(e) => setTimePart(e.target.value)}
                  className={inputClass}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-muted mb-1">Duración</label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className={inputClass}
              >
                {DURATION_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Tipo de cita</label>
            <select
              value={effectiveType}
              onChange={(e) => setType(e.target.value as AppointmentType)}
              disabled={lockType != null}
              className={`${inputClass} ${lockType != null ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {APPOINTMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {getTypeLabel(t)}
                </option>
              ))}
            </select>
            {lockType != null ? (
              <p className="text-[11px] text-muted mt-1">El tipo está fijado para este flujo.</p>
            ) : null}
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Notas (opcional)</label>
            <textarea
              value={notesBody}
              onChange={(e) => setNotesBody(e.target.value)}
              rows={3}
              placeholder="Detalles adicionales…"
              className={`${inputClass} resize-none`}
            />
          </div>

          {mode === 'edit' && (
            <div ref={statusSectionRef} className="space-y-3 pt-1 border-t border-border scroll-mt-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Estado</label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      ref={s === STATUS_OPTIONS[0] ? statusFirstButtonRef : undefined}
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

              {event?.lead_id && status === 'completed' && (
                <div className="rounded-lg border border-border/80 bg-surface/40 px-3 py-2 space-y-2">
                  <p className="text-xs font-medium text-text">Hitos en el lead (opcional)</p>
                  {(effectiveType === 'meeting' || effectiveType === 'call') && (
                    <label className="flex items-start gap-2 text-xs text-text cursor-pointer">
                      <input
                        type="checkbox"
                        checked={markCitaRealizada}
                        onChange={(e) => setMarkCitaRealizada(e.target.checked)}
                        className="mt-0.5 rounded border-border"
                      />
                      <span>Registrar cita inicial realizada (fecha de hoy)</span>
                    </label>
                  )}
                  {effectiveType === 'meeting' && (
                    <label className="flex items-start gap-2 text-xs text-text cursor-pointer">
                      <input
                        type="checkbox"
                        checked={markPropuestaPresentada}
                        onChange={(e) => setMarkPropuestaPresentada(e.target.checked)}
                        className="mt-0.5 rounded border-border"
                      />
                      <span>Registrar propuesta presentada</span>
                    </label>
                  )}
                </div>
              )}

              {!showDeleteConfirm && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-sm font-medium text-red-600 hover:underline"
                >
                  Eliminar cita
                </button>
              )}
              {showDeleteConfirm && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted">¿Eliminar esta cita?</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={loading}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                  >
                    Sí, eliminar
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
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Guardando…' : mode === 'create' ? 'Crear cita' : 'Guardar cambios'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="w-full py-2 text-sm font-medium text-muted hover:text-text transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
