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

  // Error handler (solo en dev)
  const handleError = () => {
    if (import.meta.env.DEV) {
      console.error(`[VantMark] Failed to load SVG: ${src}`)
    }
  }

  // Estilos inline para forzar tamaño (evita colapso en flex)
  const inlineStyle = {
    width: `${s}px`,
    height: `${s}px`,
    ...(animated ? { animation: 'vant-pulse 2s ease-in-out infinite' } : {}),
  }

  // Clases base para evitar colapso en flex
  const baseClasses = 'block shrink-0 object-contain'
  const finalClassName = className ? `${baseClasses} ${className}` : baseClasses

  return (
    <img
      src={src}
      alt={ariaLabel}
      width={s}
      height={s}
      className={finalClassName}
      aria-label={ariaLabel}
      draggable={false}
      onError={handleError}
      style={inlineStyle}
    />
  )
}
