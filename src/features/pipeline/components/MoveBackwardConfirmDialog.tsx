import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'

type MoveBackwardConfirmDialogProps = {
  isOpen: boolean
  leadDisplayName: string
  currentStageName: string
  targetStageName: string
  onCancel: () => void
  onConfirm: () => void
}

export function MoveBackwardConfirmDialog({
  isOpen,
  leadDisplayName,
  currentStageName,
  targetStageName,
  onCancel,
  onConfirm,
}: MoveBackwardConfirmDialogProps) {
  const prefersReducedMotion = useReducedMotion()
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[70]"
      onClick={onCancel}
      style={{ animation: prefersReducedMotion ? 'none' : 'fadeIn 150ms ease-out' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="move-backward-confirm-title"
    >
      <div
        className="card w-full max-w-md shadow-lg"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: prefersReducedMotion ? 'none' : 'slideUp 200ms ease-out' }}
      >
        <div className="px-4 pt-4 pb-3 border-b border-border/50">
          <h2 id="move-backward-confirm-title" className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            ¿Regresar este lead?
          </h2>
          <p className="text-sm text-muted mt-2 leading-relaxed">
            <span className="font-medium text-neutral-800 dark:text-neutral-200">{leadDisplayName}</span> está en{' '}
            <span className="font-medium">{currentStageName}</span>. Si lo mueves a{' '}
            <span className="font-medium">{targetStageName}</span>, se descontará del conteo semanal en{' '}
            <span className="font-medium">{currentStageName}</span> (embudo vs. meta y productividad).
          </p>
        </div>
        <div className="p-4 flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button type="button" className="btn btn-ghost text-sm order-2 sm:order-1" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary text-sm order-1 sm:order-2" onClick={onConfirm}>
            Sí, regresar y descontar
          </button>
        </div>
      </div>
    </div>
  )
}
