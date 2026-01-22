/**
 * VANT isotipo (multicolor, renderizado con <img>).
 * Uso: header, favicon, loading, error.
 * 
 * Usa <img> porque el SVG es multicolor y no puede usar CSS mask.
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
  size = 24,
  width,
  mode = 'auto',
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

  // Error handler (solo en dev)
  const handleError = () => {
    if (import.meta.env.DEV) {
      console.error(`[VantMark] Failed to load SVG: ${src}`)
    }
  }

  return (
    <img
      src={src}
      alt={ariaLabel}
      width={s}
      height={s}
      className={className}
      aria-label={ariaLabel}
      draggable={false}
      onError={handleError}
      style={animated ? { animation: 'vant-pulse 2s ease-in-out infinite' } : undefined}
    />
  )
}
