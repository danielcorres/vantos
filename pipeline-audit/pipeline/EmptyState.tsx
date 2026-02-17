export function EmptyState({
  title,
  subtitle,
  actionLabel,
  onAction,
  variant = 'dashed',
}: {
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
  variant?: 'dashed' | 'plain'
}) {
  const isDashed = variant === 'dashed'
  return (
    <div
      className={`rounded-xl bg-neutral-50 text-center ${isDashed ? 'border border-dashed border-neutral-300' : ''} px-4 py-6`}
    >
      <p className="text-sm font-medium text-neutral-700">{title}</p>
      {subtitle ? <p className="mt-1 text-xs text-neutral-500">{subtitle}</p> : null}
      {actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-3 inline-flex h-9 items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-200"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}
