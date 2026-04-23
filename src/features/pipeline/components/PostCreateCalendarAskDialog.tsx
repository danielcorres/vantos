import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'
import type { AppointmentType } from '../../calendar/types/calendar.types'
import { getTypeLabel } from '../../calendar/utils/pillStyles'

const TYPE_OPTIONS: { type: AppointmentType; label: string }[] = [
  { type: 'first_meeting', label: getTypeLabel('first_meeting') },
  { type: 'closing', label: getTypeLabel('closing') },
  { type: 'follow_up', label: getTypeLabel('follow_up') },
]

type PostCreateCalendarAskDialogProps = {
  isOpen: boolean
  onSelect: (type: AppointmentType) => void
  onSkip: () => void
}

export function PostCreateCalendarAskDialog({ isOpen, onSelect, onSkip }: PostCreateCalendarAskDialogProps) {
  const prefersReducedMotion = useReducedMotion()
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]"
      onClick={onSkip}
      style={{ animation: prefersReducedMotion ? 'none' : 'fadeIn 150ms ease-out' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="post-create-calendar-ask-title"
    >
      <div
        className="card w-full max-w-md shadow-lg"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: prefersReducedMotion ? 'none' : 'slideUp 200ms ease-out' }}
      >
        <div className="px-4 pt-4 pb-3 border-b border-border/50">
          <h2 id="post-create-calendar-ask-title" className="text-lg font-semibold text-neutral-900">
            ¿Agendar en calendario?
          </h2>
          <p className="text-sm text-muted mt-1">
            Opcional. Puedes hacerlo después desde el detalle del lead o el calendario.
          </p>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-sm text-neutral-800">Elige el tipo de cita o continúa sin agendar.</p>
          <div className="flex flex-col gap-2">
            {TYPE_OPTIONS.map(({ type, label }) => (
              <button
                key={type}
                type="button"
                className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2.5 text-left text-sm font-medium text-neutral-900 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300"
                onClick={() => onSelect(type)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="pt-1">
            <button type="button" className="btn btn-ghost text-sm w-full sm:w-auto" onClick={onSkip}>
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
