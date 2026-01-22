/**
 * VANT logo (isotipo + texto).
 * Uso: login, sidebar, pantallas de marca.
 */

import { useSystemTheme } from './useSystemTheme'

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
  const systemTheme = useSystemTheme()
  
  // Resolver el modo efectivo
  const effectiveMode = mode === 'auto' ? systemTheme : mode
  
  // Cache-busting version
  const v = '20260122'
  
  // Seleccionar el archivo SVG según el modo (ruta absoluta siempre)
  const path = effectiveMode === 'dark' 
    ? '/branding/vant-logobbg.svg'
    : '/branding/vant-logo.svg'
  
  const src = `${path}?v=${v}`

  const h = size
  const w = width ?? size

  // Estilos inline con background-image (inmune a CSS globales de img/flex)
  const inlineStyle: React.CSSProperties = {
    width: `${w}px`,
    height: `${h}px`,
    display: 'inline-block',
    flexShrink: 0,
    backgroundImage: `url("${src}")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    backgroundSize: 'contain',
    ...(animated ? { animation: 'vant-pulse 2s ease-in-out infinite' } : {}),
  }

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={inlineStyle}
    />
  )
}
