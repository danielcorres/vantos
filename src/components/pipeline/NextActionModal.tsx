import { useState, useEffect } from 'react'
import { useReducedMotion } from '../../shared/hooks/useReducedMotion'
import {
  TZ,
  getTodayYmd,
  toYmdInMonterrey,
  getNextActionLabel,
} from '../../shared/utils/nextAction'

const ACTION_TYPES = [
  { value: 'contact', label: 'Contactar', icon: '📞' },
  { value: 'meeting', label: 'Reunión', icon: '📅' },
] as const

/** Mapea tipos legacy a los nuevos (contact | meeting). */
function normalizeLegacyType(t: string | null | undefined): 'contact' | 'meeting' {
  const v = (t ?? '').trim().toLowerCase()
  if (v === 'meeting') return 'meeting'
  if (v === 'contact') return 'contact'
  if (v === 'call' || v === 'follow_up') return 'contact'
  if (v === 'presentation') return 'meeting'
  return 'contact'
}

/** Suma n días a YYYY-MM-DD. */
function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if ([y, m, d].some(Number.isNaN) || !Number.isFinite(n)) return ymd
  const next = new Date(Date.UTC(y, m - 1, d + n))
  if (isNaN(next.getTime())) return ymd
  const y2 = next.getUTCFullYear()
  const m2 = String(next.getUTCMonth() + 1).padStart(2, '0')
  const d2 = String(next.getUTCDate()).padStart(2, '0')
  return `${y2}-${m2}-${d2}`
}

/** Día de semana en Monterrey (0=Dom, 1=Lun, ..., 6=Sab). */
function getWeekdayMonterrey(d: Date): number {
  const s = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(d)
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return map[s] ?? 0
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/**
 * Próximo lunes: si base es lunes → base + 7 días; sino → siguiente lunes.
 * Caso: hoy lunes 2026-02-16 → devuelve 2026-02-23 (no 16).
 */
function nextMondayFrom(base: Date): Date {
  const d = startOfDay(base)
  const dow = getWeekdayMonterrey(d) // 0=Sun, 1=Mon, ..., 6=Sat
  let diff = (1 - dow + 7) % 7
  if (diff === 0) diff = 7
  return addDays(d, diff)
}

/** Próximo lunes en Monterrey (YYYY-MM-DD). Si hoy es lunes → lunes siguiente (+7). */
function getNextMondayYmd(now: Date = new Date()): string {
  return toYmdInMonterrey(nextMondayFrom(now))
}

/** Dom-Sab de la semana actual en Monterrey. */
function getWeekDaysYmd(now: Date = new Date()): string[] {
  const today = getTodayYmd(now)
  const w = getWeekdayMonterrey(now)
  const sunYmd = addDaysYmd(today, -w)
  return Array.from({ length: 7 }, (_, i) => addDaysYmd(sunYmd, i))
}

/** Crea Date en timezone local (asumimos Monterrey para usuarios del app). */
function ymdHourMinToDate(ymd: string, hour: number, min: number): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d, hour, min, 0)
}

/** Recomendación: Hoy 12:00, Hoy 17:00 o Mañana 10:00 — siempre minutos :00. */
function getRecommendedDate(now: Date = new Date()): { ymd: string; hour: number } {
  const today = getTodayYmd(now)
  const hour = now.getHours()
  if (hour < 12) return { ymd: today, hour: 12 }
  if (hour < 17) return { ymd: today, hour: 17 }
  return { ymd: addDaysYmd(today, 1), hour: 10 }
}

const TIME_SLOTS = [
  { label: '9:00', hour: 9 },
  { label: '10:00', hour: 10 },
  { label: '11:00', hour: 11 },
  { label: '12:00', hour: 12 },
  { label: '13:00', hour: 13 },
  { label: '16:00', hour: 16 },
  { label: '17:00', hour: 17 },
  { label: '18:00', hour: 18 },
] as const

export type NextActionModalProps = {
  isOpen: boolean
  onClose: () => void
  onSave: (next_action_at: string, next_action_type: string | null) => Promise<void>
  title?: string
  initialNextActionAt?: string | null
  initialNextActionType?: string | null
}

export function NextActionModal({
  isOpen,
  onClose,
  onSave,
  title = 'Define el próximo paso',
  initialNextActionAt,
  initialNextActionType,
}: NextActionModalProps) {
  const now = new Date()
  const todayYmd = getTodayYmd(now)
  const tomorrowYmd = addDaysYmd(todayYmd, 1)
  const in2DaysYmd = addDaysYmd(todayYmd, 2)
  const nextMondayYmd = getNextMondayYmd(now)
  const weekDays = getWeekDaysYmd(now)

  const [actionType, setActionType] = useState<'contact' | 'meeting'>('contact')
  const [selectedYmd, setSelectedYmd] = useState<string | null>(null)
  const [selectedHour, setSelectedHour] = useState<number | null>(null)
  const [customTime, setCustomTime] = useState<string>('18:00')
  const [useCustomTime, setUseCustomTime] = useState(false)
  const [showWeekCalendar, setShowWeekCalendar] = useState(false)
  const [showFullCalendar, setShowFullCalendar] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [fullCalMonth, setFullCalMonth] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const prefersReducedMotion = useReducedMotion()

  // Computed: fecha+hora final (local = Monterrey para usuarios del app)
  const getSubmitDate = (): Date | null => {
    const ymd = selectedYmd ?? todayYmd
    const hour = useCustomTime
      ? parseInt(customTime.split(':')[0] ?? '18', 10)
      : selectedHour ?? 9
    const min = useCustomTime ? parseInt(customTime.split(':')[1] ?? '0', 10) : 0
    return ymdHourMinToDate(ymd, hour, min)
  }

  const submitDate = getSubmitDate()
  const summaryLabel =
    submitDate && !isNaN(submitDate.getTime())
      ? getNextActionLabel(submitDate.toISOString())
      : null
  const hasValidSelection = selectedYmd != null && (useCustomTime || selectedHour != null)

  useEffect(() => {
    if (isOpen) {
      setError(null)
      setShowWeekCalendar(false)
      setShowFullCalendar(false)
      setShowTimePicker(false)
      const parsed =
        initialNextActionAt && initialNextActionAt.trim() !== ''
          ? new Date(initialNextActionAt)
          : null
      if (parsed && !isNaN(parsed.getTime())) {
        setActionType(normalizeLegacyType(initialNextActionType))
        setSelectedYmd(toYmdInMonterrey(parsed))
        const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
        const [h, m] = fmt.format(parsed).split(':').map(Number)
        const slot = TIME_SLOTS.find((s) => s.hour === h && m === 0)
        if (slot) {
          setSelectedHour(slot.hour)
          setUseCustomTime(false)
        } else {
          setCustomTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
          setUseCustomTime(true)
        }
      } else {
        const rec = getRecommendedDate(now)
        setActionType('contact')
        setSelectedYmd(rec.ymd)
        setSelectedHour(rec.hour)
        setUseCustomTime(false)
      }
    }
  }, [isOpen, initialNextActionAt, initialNextActionType])

  const handleDayPreset = (ymd: string) => {
    setSelectedYmd(ymd)
    setShowWeekCalendar(false)
    setShowFullCalendar(false)
  }

  const handleTimePreset = (hour: number) => {
    setSelectedHour(hour)
    setUseCustomTime(false)
    setShowTimePicker(false)
  }

  const handleCustomTime = () => {
    setUseCustomTime(true)
    setShowTimePicker(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const d = getSubmitDate()
    if (!d || isNaN(d.getTime())) {
      setError('Elige día y hora')
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

  // Calendario mensual: días del mes
  const firstDay = new Date(fullCalMonth.year, fullCalMonth.month, 1)
  const lastDay = new Date(fullCalMonth.year, fullCalMonth.month + 1, 0)
  const startPad = firstDay.getDay()
  const daysInMonth = lastDay.getDate()
  const fullCalDays: (string | null)[] = []
  for (let i = 0; i < startPad; i++) fullCalDays.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const ymd = `${fullCalMonth.year}-${String(fullCalMonth.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    fullCalDays.push(ymd)
  }

  if (!isOpen) return null

  const typeConfig = ACTION_TYPES.find((a) => a.value === actionType) ?? ACTION_TYPES[0]

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
      onClick={onClose}
      style={{ animation: prefersReducedMotion ? 'none' : 'fadeIn 150ms ease-out' }}
    >
      <div
        className="card w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: prefersReducedMotion ? 'none' : 'slideUp 200ms ease-out' }}
      >
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">{title}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo: 2 botones grandes */}
          <div>
            <p className="text-xs font-medium text-neutral-500 mb-2">Tipo</p>
            <div className="grid grid-cols-2 gap-2">
              {ACTION_TYPES.map(({ value, label, icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setActionType(value)}
                  className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-medium border-2 transition-colors ${
                    actionType === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-neutral-200 text-neutral-700 hover:border-neutral-300'
                  }`}
                >
                  <span className="text-lg">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* ¿Cuándo? — Día */}
          <div>
            <p className="text-xs font-medium text-neutral-500 mb-2">¿Cuándo?</p>
            <div className="flex flex-wrap gap-2">
              <DayChip label="Hoy" ymd={todayYmd} selected={selectedYmd === todayYmd} onSelect={() => handleDayPreset(todayYmd)} />
              <DayChip label="Mañana" ymd={tomorrowYmd} selected={selectedYmd === tomorrowYmd} onSelect={() => handleDayPreset(tomorrowYmd)} />
              <DayChip label="En 2 días" ymd={in2DaysYmd} selected={selectedYmd === in2DaysYmd} onSelect={() => handleDayPreset(in2DaysYmd)} />
              <DayChip label="Próx. lunes" ymd={nextMondayYmd} selected={selectedYmd === nextMondayYmd} onSelect={() => handleDayPreset(nextMondayYmd)} />
              <button
                type="button"
                onClick={() => setShowWeekCalendar((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  showWeekCalendar ? 'bg-primary text-white border-primary' : 'bg-white border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                Esta semana…
              </button>
              <button
                type="button"
                onClick={() => setShowFullCalendar((v) => !v)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  showFullCalendar ? 'bg-primary text-white border-primary' : 'bg-white border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                Elegir fecha…
              </button>
            </div>

            {showWeekCalendar && (
              <div className="mt-3 p-3 rounded-lg border border-neutral-200 bg-neutral-50/50 grid grid-cols-7 gap-1">
                {weekDays.map((ymd) => (
                  <button
                    key={ymd}
                    type="button"
                    onClick={() => handleDayPreset(ymd)}
                    className={`py-1.5 rounded text-xs font-medium ${
                      selectedYmd === ymd ? 'bg-primary text-white' : 'hover:bg-neutral-200'
                    }`}
                  >
                    {new Date(ymd + 'T12:00:00Z').getUTCDate()}
                  </button>
                ))}
              </div>
            )}

            {showFullCalendar && (
              <div className="mt-3 p-3 rounded-lg border border-neutral-200 bg-neutral-50/50">
                <div className="flex items-center justify-between mb-2">
                  <button
                    type="button"
                    onClick={() =>
                      setFullCalMonth((p) =>
                        p.month === 0 ? { year: p.year - 1, month: 11 } : { year: p.year, month: p.month - 1 }
                      )
                    }
                    className="p-1 rounded hover:bg-neutral-200"
                  >
                    ←
                  </button>
                  <span className="text-sm font-medium">
                    {new Date(fullCalMonth.year, fullCalMonth.month).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setFullCalMonth((p) =>
                        p.month === 11 ? { year: p.year + 1, month: 0 } : { year: p.year, month: p.month + 1 }
                      )
                    }
                    className="p-1 rounded hover:bg-neutral-200"
                  >
                    →
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-[10px] text-neutral-500">
                  {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((c) => (
                    <div key={c} className="text-center py-1">
                      {c}
                    </div>
                  ))}
                  {fullCalDays.map((ymd, i) =>
                    ymd ? (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleDayPreset(ymd)}
                        className={`py-1.5 rounded text-xs ${
                          selectedYmd === ymd ? 'bg-primary text-white' : 'hover:bg-neutral-200'
                        }`}
                      >
                        {new Date(ymd + 'T12:00:00Z').getUTCDate()}
                      </button>
                    ) : (
                      <div key={i} />
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Hora */}
          <div>
            <p className="text-xs font-medium text-neutral-500 mb-2">Hora</p>
            <div className="flex flex-wrap gap-2">
              {TIME_SLOTS.map(({ label, hour }) => (
                <button
                  key={hour}
                  type="button"
                  onClick={() => handleTimePreset(hour)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    !useCustomTime && selectedHour === hour ? 'bg-primary text-white border-primary' : 'bg-white border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={handleCustomTime}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  useCustomTime ? 'bg-primary text-white border-primary' : 'bg-white border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                Personalizar…
              </button>
            </div>
            {showTimePicker && (
              <div className="mt-2">
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg"
                />
              </div>
            )}
          </div>

          {/* Resumen grande */}
          {summaryLabel && (
            <div className="py-3 px-4 rounded-xl bg-neutral-100 text-center">
              <p className="text-lg font-semibold text-neutral-900">
                {typeConfig.icon} {typeConfig.label} · {summaryLabel}
              </p>
            </div>
          )}

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
              disabled={loading || !hasValidSelection}
              className="btn btn-primary"
            >
              {loading ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DayChip({
  label,
  selected,
  onSelect,
}: {
  label: string
  ymd: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
        selected ? 'bg-primary text-white border-primary' : 'bg-white border-neutral-200 hover:bg-neutral-50'
      }`}
    >
      {label}
    </button>
  )
}
