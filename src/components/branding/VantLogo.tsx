/**
 * VANT logo (icono + texto "vant").
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

const BRANDING_VERSION = '20260122-01'

export function VantLogo({
  size = 64,
  width,
  mode = 'auto',
  animated = false,
  className = '',
  'aria-label': ariaLabel = 'vant',
}: VantLogoProps) {
  const systemTheme = useSystemTheme()
  
  // Resolver el modo efectivo
  const effectiveMode = mode === 'auto' ? systemTheme : mode
  
  // Seleccionar el archivo SVG según el modo (ruta absoluta siempre)
  const path = effectiveMode === 'dark'
    ? '/branding/vant-logobbg.svg'
    : '/branding/vant-logo.svg'
  
  const src = `${path}?v=${BRANDING_VERSION}`

  // Tamaños: size controla altura, width respeta proporción viewBox (120/32 = 3.75)
  const h = size
  const defaultWidth = size * 3.75
  const w = width ?? defaultWidth

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
