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

  // Error handler (solo en dev)
  const handleError = () => {
    if (import.meta.env.DEV) {
      console.error(`[VantLogo] Failed to load SVG: ${src}`)
    }
  }

  // Estilos inline para forzar tamaño (evita colapso en flex)
  const inlineStyle = {
    width: `${w}px`,
    height: `${h}px`,
    ...(animated ? { animation: 'vant-pulse 2s ease-in-out infinite' } : {}),
  }

  // Clases base para evitar colapso en flex
  const baseClasses = 'block shrink-0 object-contain'
  const finalClassName = className ? `${baseClasses} ${className}` : baseClasses

  return (
    <img
      src={src}
      alt={ariaLabel}
      width={w}
      height={h}
      className={finalClassName}
      aria-label={ariaLabel}
      draggable={false}
      onError={handleError}
      style={inlineStyle}
    />
  )
}
