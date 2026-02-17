import { IconCopy } from '../../app/layout/icons'

/**
 * Línea de contacto (tel/email) con ícono izquierdo y botón copiar.
 * - Desktop: el botón copiar puede ir con opacity controlado por el padre (group-hover).
 * - Mobile: siempre visible, pero con hit-area suficiente.
 */
export function LeadContactLine({
  icon,
  value,
  ariaLabel,
  onCopy,
  copyMessage,
  compact = false,
  showCopyAlways = false,
}: {
  icon: React.ReactNode
  value: string | null | undefined
  ariaLabel: string
  onCopy?: (text: string, toastMessage: string) => void
  copyMessage: string
  compact?: boolean
  showCopyAlways?: boolean
}) {
  const v = value?.trim() ?? ''

  return (
    <div className={`flex items-center gap-2 min-w-0 ${compact ? '' : ''}`}>
      <span className="shrink-0">{icon}</span>
      {v ? (
        <span className={`${compact ? 'text-xs' : 'text-sm'} text-neutral-700 truncate min-w-0`}>{v}</span>
      ) : (
        <span className={`${compact ? 'text-xs' : 'text-sm'} text-neutral-400`}>—</span>
      )}
      {v && onCopy ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onCopy(v, copyMessage)
          }}
          className={
            showCopyAlways
              ? 'ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200'
              : 'ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-white hover:border-neutral-200 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity'
          }
          aria-label={ariaLabel}
        >
          <IconCopy className={compact ? 'w-4 h-4' : 'w-4 h-4'} />
        </button>
      ) : null}
    </div>
  )
}
