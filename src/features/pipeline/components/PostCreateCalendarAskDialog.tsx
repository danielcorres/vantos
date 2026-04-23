import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'

type PostCreateCalendarAskDialogProps = {
  isOpen: boolean
  onYes: () => void
  onNo: () => void
}

export function PostCreateCalendarAskDialog({ isOpen, onYes, onNo }: PostCreateCalendarAskDialogProps) {
  const prefersReducedMotion = useReducedMotion()
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]"
      onClick={onNo}
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
        <div className="p-4 space-y-4">
          <p className="text-sm text-neutral-800">
            ¿Quieres agendar una cita en el calendario ligada a este lead?
          </p>
          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
            <button type="button" className="btn btn-ghost text-sm" onClick={onNo}>
              No, gracias
            </button>
            <button type="button" className="btn btn-primary text-sm" onClick={onYes}>
              Sí, agendar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
