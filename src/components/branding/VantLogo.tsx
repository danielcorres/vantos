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
  mode = 'auto',
  animated = false,
  className = '',
  'aria-label': ariaLabel = 'VANT',
}: VantLogoProps) {
  const systemTheme = useSystemTheme()
  
  // Resolver el modo efectivo
  const effectiveMode = mode === 'auto' ? systemTheme : mode
  
  // Cache-busting version
  const v = '20260122'
  
  // Calcular tamaño efectivo para decidir entre mark y logo
  const h = size
  const w = width ?? size
  const effectiveSize = w
  
  // Usar mark en tamaños pequeños (< 72px), logo en tamaños grandes (>= 72px)
  const useMark = effectiveSize < 72
  
  // Seleccionar el archivo SVG según el tamaño y el modo (ruta absoluta siempre)
  const path = useMark
    ? (effectiveMode === 'dark' ? '/branding/vant-markbbg.svg' : '/branding/vant-mark.svg')
    : (effectiveMode === 'dark' ? '/branding/vant-logobbg.svg' : '/branding/vant-logo.svg')
  
  const src = `${path}?v=${v}`

  // Error handler (solo en dev)
  const handleError = () => {
    if (import.meta.env.DEV) {
      console.error(`[VantLogo] Failed to load SVG: ${src}`)
    }
  }

  return (
    <img
      src={src}
      alt={ariaLabel}
      width={w}
      height={h}
      className={className}
      aria-label={ariaLabel}
      draggable={false}
      onError={handleError}
      style={animated ? { animation: 'vant-pulse 2s ease-in-out infinite' } : undefined}
    />
  )
}
