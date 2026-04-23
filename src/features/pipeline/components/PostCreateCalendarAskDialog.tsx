import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'

type PostCreateCalendarAskDialogProps = {
  isOpen: boolean
  onAgendar: () => void
  onSkip: () => void
}

export function PostCreateCalendarAskDialog({ isOpen, onAgendar, onSkip }: PostCreateCalendarAskDialogProps) {
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
            ¿Agendar cita ahora?
          </h2>
          <p className="text-sm text-muted mt-1">
            Opcional. Podrás elegir el tipo de cita en el siguiente paso, o hacerlo después desde el lead o el
            calendario.
          </p>
        </div>
        <div className="p-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button type="button" className="btn btn-ghost text-sm order-2 sm:order-1" onClick={onSkip}>
            Ahora no
          </button>
          <button type="button" className="btn btn-primary text-sm order-1 sm:order-2" onClick={onAgendar}>
            Agendar
          </button>
        </div>
      </div>
    </div>
  )
}
