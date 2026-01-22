/**
 * VANT isotipo (solo triángulo, cuadrado).
 * Uso: header, favicon, loading, error.
 */

import { useSystemTheme } from './useSystemTheme'

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
  const systemTheme = useSystemTheme()
  
  // Resolver el modo efectivo
  const effectiveMode = mode === 'auto' ? systemTheme : mode
  
  // Cache-busting version
  const v = '20260122'
  
  // Seleccionar el archivo SVG según el modo (ruta absoluta siempre)
  const path = effectiveMode === 'dark'
    ? '/branding/vant-markbbg.svg'
    : '/branding/vant-mark.svg'
  
  const src = `${path}?v=${v}`

  const s = width ?? size

  // Estilos inline con background-image (inmune a CSS globales de img/flex)
  const inlineStyle: React.CSSProperties = {
    width: `${s}px`,
    height: `${s}px`,
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
