type Props = {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  /** danger = botón confirmar rojo */
  variant?: 'default' | 'danger'
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  busy?: boolean
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  variant = 'default',
  onConfirm,
  onCancel,
  busy = false,
}: Props) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-surface shadow-lg dark:bg-neutral-900 dark:border-neutral-700">
        <div className="p-4 border-b border-border dark:border-neutral-800">
          <h2 id="confirm-dialog-title" className="text-lg font-semibold text-text dark:text-neutral-100">
            {title}
          </h2>
        </div>
        <p className="p-4 text-sm text-text dark:text-neutral-200 whitespace-pre-wrap">{message}</p>
        <div className="flex justify-end gap-2 p-4 border-t border-border dark:border-neutral-800">
          <button
            type="button"
            className="btn btn-secondary text-sm"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`btn text-sm ${
              variant === 'danger' ? 'bg-red-600 text-white hover:opacity-90 border-0' : 'btn-primary'
            }`}
            disabled={busy}
            onClick={() => void onConfirm()}
          >
            {busy ? 'Procesando…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
