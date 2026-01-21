/**
 * VANT isotipo (solo triángulo, cuadrado).
 * Uso: header, favicon, loading, error.
 */

type VantMarkProps = {
  size?: number
  width?: number
  mode?: 'light' | 'dark' | 'auto'
  animated?: boolean
  className?: string
  'aria-label'?: string
}

export function VantMark({
  size = 40,
  width,
  mode = 'light',
  animated = false,
  className = '',
  'aria-label': ariaLabel = 'VANT',
}: VantMarkProps) {
  const s = width ?? size

  if (mode === 'auto') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="40 32 176 184"
        width={s}
        height={s}
        className={className}
        aria-label={ariaLabel}
        style={animated ? { animation: 'vant-pulse 2s ease-in-out infinite' } : undefined}
      >
        <path d="M40 32 L128 216 L216 32 Z" className="fill-[#0B1C2D] dark:fill-white" />
        <path d="M88 104 L128 192 L168 104 Z" className="fill-white dark:fill-[#0B1C2D]" />
      </svg>
    )
  }

  const outer = mode === 'dark' ? '#FFFFFF' : '#0B1C2D'
  const inner = mode === 'dark' ? '#0B1C2D' : '#FFFFFF'

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="40 32 176 184"
      width={s}
      height={s}
      className={className}
      aria-label={ariaLabel}
      style={animated ? { animation: 'vant-pulse 2s ease-in-out infinite' } : undefined}
    >
      <path d="M40 32 L128 216 L216 32 Z" fill={outer} />
      <path d="M88 104 L128 192 L168 104 Z" fill={inner} />
    </svg>
  )
}
