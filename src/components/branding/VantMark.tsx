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
  
  // Construir ruta base
  const base = import.meta.env.BASE_URL || '/'
  
  // Seleccionar el archivo SVG según el modo
  const src = effectiveMode === 'dark'
    ? `${base}branding/vant-markbbg.svg`
    : `${base}branding/vant-mark.svg`

  const s = width ?? size

  return (
    <img
      src={src}
      alt={ariaLabel}
      width={s}
      height={s}
      className={className}
      aria-label={ariaLabel}
      draggable={false}
      style={animated ? { animation: 'vant-pulse 2s ease-in-out infinite' } : undefined}
    />
  )
}
