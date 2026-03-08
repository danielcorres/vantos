import { getNextActionBucket } from '../../shared/utils/nextAction'
import { chipBase, chipSizeSm, chipTint } from '../../shared/utils/chips'
import {
  getNextActionType,
  formatNextActionDateLabel,
  type NextActionType,
} from '../../features/pipeline/domain/pipeline.domain'

const TYPE_CONFIG: Record<NextActionType, { icon: string; label: string }> = {
  contact: { icon: '📞', label: 'Contactar' },
  meeting: { icon: '🗓️', label: 'Reunión' },
}

const DATE_LABEL_NONE = 'Sin fecha'

/** Clase de color para la fecha según bucket (tabla desktop). */
function getDateStatusClass(
  bucket: ReturnType<typeof getNextActionBucket>,
  hasDate: boolean
): string {
  if (!hasDate) return 'text-neutral-400'
  if (bucket === 'overdue') return 'text-red-600'
  if (bucket === 'today') return 'text-emerald-600 font-medium'
  return 'text-neutral-500'
}

export function NextActionChip({
  nextActionAt,
  nextActionType,
  onClick,
  className = '',
  variant = 'default',
}: {
  nextActionAt: string | null
  nextActionType: string | null
  onClick?: () => void
  className?: string
  variant?: 'default' | 'table'
}) {
  const type = getNextActionType({ next_action_type: nextActionType })
  const config = type ? TYPE_CONFIG[type] : null
  const hasDate = nextActionAt != null && nextActionAt.trim() !== ''
  const overdue = hasDate && getNextActionBucket(nextActionAt) === 'overdue'

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onClick?.()
  }

  // Sin tipo → estado vacío (selecciona próximo paso)
  if (!type || !config) {
    const emptyChipClass = `${chipBase} ${chipSizeSm} ${chipTint.neutral} cursor-pointer hover:bg-neutral-100/60 transition-colors`
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

  const typeLabel = config.label
  const dateLabel = hasDate ? formatNextActionDateLabel(nextActionAt) : DATE_LABEL_NONE
  const singleLineText = `${config.icon} ${typeLabel} · ${dateLabel}`

  const chipStyle =
    config.label === 'Reunión'
      ? 'bg-emerald-100 border-emerald-300 text-emerald-900 hover:bg-emerald-100/90'
      : config.label === 'Contactar'
        ? 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-50/90'
        : 'bg-neutral-50 border-neutral-200 text-neutral-800 hover:bg-neutral-100/60'

  const chipClass = `inline-flex items-center gap-1 rounded-full border font-medium text-sm leading-none min-w-0 max-w-full truncate ${chipStyle} cursor-pointer transition-colors ${overdue ? 'text-red-700' : ''}`

  // Variant "table": layout 2 líneas, acción principal + fecha semántica
  if (variant === 'table') {
    const bucket = getNextActionBucket(nextActionAt)
    const dateStatusClass = getDateStatusClass(bucket, hasDate)
    const baseClass =
      'inline-flex flex-col items-start gap-0.5 min-w-0 max-w-full cursor-pointer rounded-lg px-2 py-1.5 -mx-0.5 -my-0.5 hover:bg-neutral-50 transition-colors text-left'
    const btnClass = onClick ? baseClass : baseClass.replace('cursor-pointer', 'cursor-default')

    const content = (
      <>
        <span className="font-semibold text-neutral-900 text-sm truncate max-w-full">
          {config.icon} {typeLabel}
        </span>
        <span className={`text-xs ${dateStatusClass} truncate max-w-full`}>
          {dateLabel}
        </span>
      </>
    )

    if (onClick) {
      return (
        <button
          type="button"
          data-stop-rowclick="true"
          onClick={handleClick}
          className={`${btnClass} ${className}`}
        >
          {content}
        </button>
      )
    }
    return <span className={`${btnClass} ${className}`}>{content}</span>
  }

  if (onClick) {
    return (
      <button
        type="button"
        data-stop-rowclick="true"
        onClick={handleClick}
        className={`${chipClass} px-2.5 py-1 ${className}`}
      >
        {singleLineText}
      </button>
    )
  }
  return (
    <span className={`${chipClass} px-2.5 py-1 ${className}`}>
      {singleLineText}
    </span>
  )
}
