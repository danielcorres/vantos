import { useState, useEffect } from 'react'
import { useReducedMotion } from '../../shared/hooks/useReducedMotion'

const ACTION_TYPES = [
  { value: 'call', label: 'Llamada' },
  { value: 'meeting', label: 'Reunión' },
  { value: 'follow_up', label: 'Seguimiento' },
  { value: 'presentation', label: 'Presentación' },
] as const

function todayAt(hour: number): Date {
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  return d
}

function tomorrowAt(hour: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(hour, 0, 0, 0)
  return d
}

function nextBusinessDayAt10(): Date {
  let d = new Date()
  d.setDate(d.getDate() + 1)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  d.setHours(10, 0, 0, 0)
  return d
}

/** Recomendación por horario local: <10→hoy 10, <12→hoy 12, <17→hoy 17, else→mañana 10 */
function getRecommendedNextAction(): { date: Date; label: string } {
  const now = new Date()
  const hour = now.getHours()
  if (hour < 10) return { date: todayAt(10), label: 'Hoy 10' }
  if (hour < 12) return { date: todayAt(12), label: 'Hoy 12' }
  if (hour < 17) return { date: todayAt(17), label: 'Hoy 17' }
  return { date: tomorrowAt(10), label: 'Mañana 10' }
}

function toDatetimeLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day}T${h}:${min}`
}

function parseDatetimeLocal(s: string): Date {
  const d = new Date(s)
  return isNaN(d.getTime()) ? new Date() : d
}

export type NextActionModalProps = {
  isOpen: boolean
  onClose: () => void
  onSave: (next_action_at: string, next_action_type: string | null) => Promise<void>
  title?: string
}

export function NextActionModal({
  isOpen,
  onClose,
  onSave,
  title = 'Próxima acción',
}: NextActionModalProps) {
  const [pickedAt, setPickedAt] = useState<Date>(() => todayAt(10))
  const [datetimeLocal, setDatetimeLocal] = useState<string>(() => toDatetimeLocal(todayAt(10)))
  const [activePresetLabel, setActivePresetLabel] = useState<string | null>('Hoy 10')
  const [actionType, setActionType] = useState<string | null>('call')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const prefersReducedMotion = useReducedMotion()

  // Auto-selecciona next_action_at recomendado por horario local al abrir (Guardar habilitado sin fricción)
  useEffect(() => {
    if (isOpen) {
      const { date, label } = getRecommendedNextAction()
      setPickedAt(date)
      setDatetimeLocal(toDatetimeLocal(date))
      setActivePresetLabel(label)
      setActionType('call')
      setError(null)
    }
  }, [isOpen])

  const presets: { label: string; get: () => Date }[] = [
    { label: 'Hoy 10', get: () => todayAt(10) },
    { label: 'Hoy 12', get: () => todayAt(12) },
    { label: 'Hoy 17', get: () => todayAt(17) },
    { label: 'Mañana 10', get: () => tomorrowAt(10) },
    { label: 'Mañana 12', get: () => tomorrowAt(12) },
    { label: 'Próx. hábil 10', get: nextBusinessDayAt10 },
  ]

  const handlePreset = (label: string, getDate: () => Date) => {
    const d = getDate()
    setPickedAt(d)
    setDatetimeLocal(toDatetimeLocal(d))
    setActivePresetLabel(label)
  }

  const handleDatetimeChange = (value: string) => {
    setDatetimeLocal(value)
    setActivePresetLabel(null)
    const d = parseDatetimeLocal(value)
    if (!isNaN(d.getTime())) setPickedAt(d)
  }

  const getSubmitAt = (): Date => (activePresetLabel ? pickedAt : parseDatetimeLocal(datetimeLocal))
  const hasValidNextAction = () => {
    const d = getSubmitAt()
    return !isNaN(d.getTime())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const d = getSubmitAt()
    if (isNaN(d.getTime())) {
      setError('Elige una fecha y hora')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await onSave(d.toISOString(), actionType)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
      style={{ animation: prefersReducedMotion ? 'none' : 'fadeIn 150ms ease-out' }}
    >
      <div
        className="card w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: prefersReducedMotion ? 'none' : 'slideUp 200ms ease-out' }}
      >
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">{title}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="text-xs font-medium text-neutral-500 mb-2">Fecha y hora</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {presets.map(({ label, get }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => handlePreset(label, get)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    activePresetLabel === label
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="datetime-local"
              value={datetimeLocal}
              onChange={(e) => handleDatetimeChange(e.target.value)}
              className="w-full px-2.5 py-1.5 text-sm border border-border rounded bg-bg text-text"
            />
          </div>

          <div>
            <p className="text-xs font-medium text-neutral-500 mb-2">Tipo de acción</p>
            <div className="flex flex-wrap gap-2">
              {ACTION_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setActionType(value)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    actionType === value
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !hasValidNextAction()}
              className="btn btn-primary"
            >
              {loading ? 'Guardando…' : 'Guardar y continuar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
