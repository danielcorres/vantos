import { getNextActionBucket } from '../../shared/utils/nextAction'
import { chipBase, chipSizeSm, chipTint } from '../../shared/utils/chips'
import {
  getNextActionType,
  formatNextActionDateLabel,
  formatNextActionTimeOnly,
  getNextActionUrgencyLabel,
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
  hasDate: boolean,
  isTomorrow: boolean
): string {
  if (!hasDate) return 'text-neutral-400'
  if (bucket === 'overdue') return 'text-red-500'
  if (bucket === 'today') return 'text-emerald-600 font-medium'
  if (isTomorrow) return 'text-neutral-600 font-medium'
  return 'text-neutral-500'
}

/** Clase para urgencia en línea 1 (kanban): "Atrasado" destaca, resto sobrio. */
function getKanbanUrgencyLineClass(bucket: ReturnType<typeof getNextActionBucket>, urgencyLabel: string): string {
  if (bucket === 'overdue' && urgencyLabel === 'Atrasado') return 'font-medium text-red-600'
  if (urgencyLabel === 'Hoy') return 'font-medium text-emerald-600'
  if (urgencyLabel === 'Mañana') return 'font-medium text-neutral-600'
  return 'text-neutral-600'
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
  variant?: 'default' | 'table' | 'kanban'
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
    const emptyChipClass =
      variant === 'kanban'
        ? `${chipBase} ${chipSizeSm} border-2 border-dashed border-neutral-300 bg-neutral-50/90 text-neutral-700 cursor-pointer transition-all duration-150 hover:border-sky-400 hover:bg-sky-100 hover:text-sky-950 hover:shadow-sm active:bg-sky-200/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-1`
        : `${chipBase} ${chipSizeSm} ${chipTint.neutral} cursor-pointer hover:bg-neutral-100/60 transition-colors`
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

  // Variant "kanban": línea 1 = urgencia · acción | línea 2 = hora o fecha. Sin íconos para consistencia.
  if (variant === 'kanban') {
    const bucket = getNextActionBucket(nextActionAt)
    const urgencyLabel = getNextActionUrgencyLabel(nextActionAt)
    const isTodayOrTomorrow = urgencyLabel === 'Hoy' || urgencyLabel === 'Mañana'
    const line2 = hasDate
      ? isTodayOrTomorrow
        ? formatNextActionTimeOnly(nextActionAt)
        : dateLabel
      : DATE_LABEL_NONE
    const urgencyClass = getKanbanUrgencyLineClass(bucket, urgencyLabel)
    const dateStatusClass = getDateStatusClass(bucket, hasDate, urgencyLabel === 'Mañana')
    const baseClass =
      'inline-flex flex-col items-start gap-0.5 min-w-0 max-w-full cursor-pointer rounded-md border border-transparent px-1.5 py-0.5 -mx-0.5 -my-0.5 text-left transition-all duration-150 hover:border-sky-300 hover:bg-sky-50 hover:shadow-sm active:bg-sky-100/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-1'
    const btnClass = onClick ? baseClass : baseClass.replace('cursor-pointer', 'cursor-default')

    const content = (
      <>
        <span className="text-xs leading-tight">
          {urgencyLabel && (
            <>
              <span className={urgencyClass}>{urgencyLabel}</span>
              <span className="text-neutral-500"> · </span>
            </>
          )}
          <span className="text-neutral-700">{typeLabel}</span>
        </span>
        <span className={`text-[11px] leading-tight whitespace-nowrap ${dateStatusClass}`}>
          {line2}
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

  // Variant "table": layout 2 líneas, acción principal + fecha semántica
  if (variant === 'table') {
    const bucket = getNextActionBucket(nextActionAt)
    const isTomorrow = hasDate && dateLabel.startsWith('Mañana')
    const dateStatusClass = getDateStatusClass(bucket, hasDate, !!isTomorrow)
    const baseClass =
      'inline-flex flex-col items-start gap-1 min-w-0 max-w-full cursor-pointer rounded-lg px-2 py-1.5 -mx-0.5 -my-0.5 hover:bg-neutral-50 transition-colors text-left'
    const btnClass = onClick ? baseClass : baseClass.replace('cursor-pointer', 'cursor-default')

    const content = (
      <>
        <span className="font-semibold text-neutral-900 text-sm leading-tight">
          {config.icon} {typeLabel}
        </span>
        <span className={`text-xs leading-tight whitespace-nowrap ${dateStatusClass}`}>
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
