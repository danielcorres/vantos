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
  
  // Seleccionar el archivo SVG según el modo
  const src = effectiveMode === 'dark' 
    ? '/branding/vant-logobbg.svg'
    : '/branding/vant-logo.svg'

  const h = size
  const w = width ?? size

  return (
    <img
      src={src}
      alt={ariaLabel}
      width={w}
      height={h}
      className={className}
      aria-label={ariaLabel}
      draggable={false}
      style={animated ? { animation: 'vant-pulse 2s ease-in-out infinite' } : undefined}
    />
  )
}
