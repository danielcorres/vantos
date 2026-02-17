import { getNextActionLabel } from '../../shared/utils/nextAction'

const TYPE_CONFIG: Record<string, { icon: string; label: string }> = {
  contact: { icon: '📞', label: 'Contactar' },
  meeting: { icon: '🗓️', label: 'Reunión' },
  call: { icon: '📞', label: 'Contactar' },
  follow_up: { icon: '📞', label: 'Contactar' },
  presentation: { icon: '🗓️', label: 'Reunión' },
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
  let label: string
  if (!hasValue) {
    label = '➕ Selecciona próximo paso'
  } else if (config) {
    label = `${config.icon} ${config.label} · ${getNextActionLabel(nextActionAt)}`
  } else {
    label = `Próximo paso · ${getNextActionLabel(nextActionAt)}`
  }

  const baseClass =
    'inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-50 transition-colors shrink-0'

  if (onClick) {
    return (
      <button
        type="button"
        data-stop-rowclick="true"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onClick()
        }}
        className={`${baseClass} cursor-pointer ${className}`}
      >
        {label}
      </button>
    )
  }

  return <span className={`${baseClass} ${className}`}>{label}</span>
}
