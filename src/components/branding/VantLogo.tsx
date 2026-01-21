/**
 * VANT logo (isotipo + texto).
 * Uso: login, sidebar, pantallas de marca.
 */

type VantLogoProps = {
  size?: number
  width?: number
  mode?: 'light' | 'dark' | 'auto'
  animated?: boolean
  className?: string
  'aria-label'?: string
}

export function VantLogo({
  size = 120,
  width,
  mode = 'light',
  animated = false,
  className = '',
  'aria-label': ariaLabel = 'VANT',
}: VantLogoProps) {
  const h = size
  const w = width ?? (size * 256) / 320

  const iso =
    mode === 'auto' ? (
      <>
        <path d="M40 32 L128 216 L216 32 Z" className="fill-[#0B1C2D] dark:fill-white" />
        <path d="M88 104 L128 192 L168 104 Z" className="fill-white dark:fill-[#0B1C2D]" />
      </>
    ) : (
      <>
        <path d="M40 32 L128 216 L216 32 Z" fill={mode === 'dark' ? '#FFFFFF' : '#0B1C2D'} />
        <path d="M88 104 L128 192 L168 104 Z" fill={mode === 'dark' ? '#0B1C2D' : '#FFFFFF'} />
      </>
    )

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 320"
      width={w}
      height={h}
      className={className}
      aria-label={ariaLabel}
      style={animated ? { animation: 'vant-pulse 2s ease-in-out infinite' } : undefined}
    >
      {iso}
      <text
        x="128"
        y="292"
        fill={mode === 'auto' ? undefined : mode === 'dark' ? '#FFFFFF' : '#0B1C2D'}
        fontSize={56}
        fontFamily="Inter, SF Pro Display, Helvetica Neue, Arial, sans-serif"
        fontWeight={600}
        letterSpacing={6}
        textAnchor="middle"
        className={mode === 'auto' ? 'fill-[#0B1C2D] dark:fill-white' : ''}
      >
        VANT
      </text>
    </svg>
  )
}
