/**
 * VANT logo (lockup horizontal: isotipo + texto).
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
  // Mantener compatibilidad: `size` controla la altura
  // Proporción del nuevo SVG: 640 x 200  => width = height * (640/200) = height * 3.2
  const h = size
  const w = width ?? h * (640 / 200)

  const textFill =
    mode === 'auto'
      ? undefined
      : mode === 'dark'
        ? '#FFFFFF'
        : '#0B1C2D'

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 640 200"
      width={w}
      height={h}
      className={className}
      aria-label={ariaLabel}
      style={animated ? { animation: 'vant-pulse 2s ease-in-out infinite' } : undefined}
    >
      {/* Isotipo */}
      <g transform="translate(40,36)">
        {/* Fondo del isotipo (se queda azul en light/dark/auto, como en tu SVG) */}
        <rect x="0" y="0" width="128" height="128" rx="24" fill="#0B1C2D" />
        {/* V recortada */}
        <path d="M36 40 L64 96 L92 40 Z" fill="#FFFFFF" />
      </g>

      {/* Texto VANT */}
      <text
        x="210"
        y="126"
        fontSize={84}
        fontFamily="Inter, SF Pro Display, Helvetica Neue, Arial, sans-serif"
        fontWeight={700}
        letterSpacing={6}
        // Modo auto: usa clases dark: para invertir el texto
        fill={textFill}
        className={mode === 'auto' ? 'fill-[#0B1C2D] dark:fill-white' : ''}
        style={mode === 'dark' ? { fill: '#FFFFFF' } : undefined}
      >
        VANT
      </text>
    </svg>
  )
}
