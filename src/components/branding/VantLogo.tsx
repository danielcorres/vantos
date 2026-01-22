/**
 * VANT logo (isotipo check + texto "VANT").
 * Uso: login, sidebar, pantallas de marca.
 * 
 * Usa CSS mask para el isotipo y texto HTML para "VANT".
 * Layout horizontal: isotipo + texto.
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
  size = 84,
  width,
  mode = 'auto',
  animated = false,
  className = '',
  'aria-label': ariaLabel = 'VANT',
}: VantLogoProps) {
  // Calcular tamaños
  const h = size
  const maxWidth = width ? `${width}px` : undefined
  
  // Tamaño del isotipo (proporcionalmente más chico que el texto)
  const markSize = Math.round(h * 0.42)
  const gap = Math.round(h * 0.18)

  // Clases de color según mode (SSR-safe, solo Tailwind)
  const colorClass = mode === 'light' 
    ? 'text-slate-900' 
    : mode === 'dark' 
    ? 'text-white' 
    : 'text-slate-900 dark:text-white'

  // Estilos para el contenedor
  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: `${gap}px`,
    height: `${h}px`,
    ...(maxWidth ? { maxWidth } : {}),
    ...(animated ? { animation: 'vant-pulse 2s ease-in-out infinite' } : {}),
  }

  // Estilos para el isotipo (CSS mask)
  const markStyle: React.CSSProperties = {
    width: `${markSize}px`,
    height: `${markSize}px`,
    display: 'inline-block',
    flexShrink: 0,
    WebkitMaskImage: `url('/branding/vant-mark.svg')`,
    maskImage: `url('/branding/vant-mark.svg')`,
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    backgroundColor: 'currentColor',
    userSelect: 'none',
  }

  // Estilos para el texto
  const textStyle: React.CSSProperties = {
    fontSize: `${Math.round(h * 0.52)}px`,
    lineHeight: 1,
    fontFamily: 'Inter, SF Pro Display, Helvetica Neue, Arial, sans-serif',
    fontWeight: 600,
    letterSpacing: '0.25em',
    userSelect: 'none',
  }

  // Combinar clases
  const finalClassName = className ? `${colorClass} ${className}` : colorClass

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={finalClassName}
      style={containerStyle}
    >
      <span style={markStyle} aria-hidden="true" />
      <span style={textStyle} aria-hidden="true">VANT</span>
    </span>
  )
}
