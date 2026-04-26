interface LoadingSpinnerProps {
  size?: number
  label?: string
  className?: string
}

export function LoadingSpinner({ size = 24, label, className = '' }: LoadingSpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label ?? 'Cargando'}
      className={`inline-flex items-center gap-2 ${className}`.trim()}
    >
      <span
        aria-hidden="true"
        className="rounded-full border-2 border-current/20 border-t-current animate-spin"
        style={{ width: size, height: size }}
      />
      {label && <span className="text-sm text-muted">{label}</span>}
    </span>
  )
}
