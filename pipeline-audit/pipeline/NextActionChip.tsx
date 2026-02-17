import { getNextActionBucket, TZ, toYmdInMonterrey, getTodayYmd } from '../../shared/utils/nextAction'
import { chipBase, chipSizeSm, chipTint } from '../../shared/utils/chips'

const TYPE_CONFIG: Record<string, { icon: string; label: string }> = {
  contact: { icon: '📞', label: 'Contactar' },
  meeting: { icon: '🗓️', label: 'Reunión' },
  call: { icon: '📞', label: 'Contactar' },
  follow_up: { icon: '📞', label: 'Contactar' },
  presentation: { icon: '🗓️', label: 'Reunión' },
}

/** Suma 1 día a YYYY-MM-DD. */
function addOneDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return ymd
  const next = new Date(Date.UTC(y, m - 1, d + 1))
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`
}

/** Formato: "Mié 18 · 6:30 p.m." o "Hoy · 6:30 p.m." / "Mañana · 10:00 a.m." (es-MX, TZ). */
function formatNextActionDate(at: string | Date): string {
  const d = typeof at === 'string' ? new Date(at) : at
  if (isNaN(d.getTime())) return ''
  const opts: Intl.DateTimeFormatOptions = { timeZone: TZ }
  const leadYmd = toYmdInMonterrey(d)
  const todayYmd = getTodayYmd()
  const tomorrowYmd = addOneDay(todayYmd)

  let prefix: string
  if (leadYmd === todayYmd) {
    prefix = 'Hoy'
  } else if (leadYmd === tomorrowYmd) {
    prefix = 'Mañana'
  } else {
    const weekday = new Intl.DateTimeFormat('es-MX', { ...opts, weekday: 'short' }).format(d)
    const day = new Intl.DateTimeFormat('es-MX', { ...opts, day: 'numeric' }).format(d)
    prefix = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} ${day}`
  }

  const time = new Intl.DateTimeFormat('es-MX', {
    ...opts,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(d)
    .replace(/\.\s*\./g, '.')
  return `${prefix} · ${time}`
}

export function NextActionChip({
  nextActionAt,
  nextActionType,
  onClick,
  className = '',
}: {
  nextActionAt: string | null
  nextActionType: string | null
  onClick?: () => void
  className?: string
}) {
  const hasValue = nextActionAt != null && nextActionAt.trim() !== ''
  const config = nextActionType && TYPE_CONFIG[nextActionType] ? TYPE_CONFIG[nextActionType] : null
  const overdue = hasValue && getNextActionBucket(nextActionAt) === 'overdue'

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onClick?.()
  }

  const emptyChipClass = `${chipBase} ${chipSizeSm} ${chipTint.neutral} cursor-pointer hover:bg-neutral-100/60 transition-colors`

  if (!hasValue) {
    if (onClick) {
      return (
        <button
          type="button"
          data-stop-rowclick="true"
          onClick={handleClick}
          className={`${emptyChipClass} ${className}`}
        >
          ➕ Selecciona próximo paso
        </button>
      )
    }
    return (
      <span className={`${chipBase} ${chipSizeSm} ${chipTint.graySoft} ${className}`}>
        ➕ Selecciona próximo paso
      </span>
    )
  }

  const typeLabel = config ? `${config.icon} ${config.label}` : 'Próximo paso'
  const dateLabel = formatNextActionDate(nextActionAt!)

  const typeChipStyle =
    config?.label === 'Reunión'
      ? 'bg-emerald-100 border-emerald-300 text-emerald-900 hover:bg-emerald-100/90'
      : config?.label === 'Contactar'
        ? 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-50/90'
        : 'bg-neutral-50 border-neutral-200 text-neutral-800 hover:bg-neutral-100/60'

  const dateTextClass = overdue
    ? 'text-[11px] leading-none text-red-700'
    : 'text-[11px] leading-none text-neutral-500'

  const typeChipClass = `${chipBase} ${chipSizeSm} ${typeChipStyle} cursor-pointer transition-colors`

  const chipButton = onClick ? (
    <button
      type="button"
      data-stop-rowclick="true"
      onClick={handleClick}
      className={typeChipClass}
    >
      {typeLabel}
    </button>
  ) : (
    <span className={typeChipClass}>{typeLabel}</span>
  )

  return (
    <div className={`inline-flex flex-col items-start gap-0.5 shrink-0 ${className}`}>
      {chipButton}
      <span className={dateTextClass}>{dateLabel}</span>
    </div>
  )
}
