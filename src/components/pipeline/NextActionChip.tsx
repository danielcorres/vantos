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
