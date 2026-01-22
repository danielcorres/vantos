/**
 * VANT isotipo (check icon usando CSS mask).
 * Uso: header, favicon, loading, error.
 * 
 * Usa CSS mask para que el color se adapte automáticamente a light/dark
 * mediante currentColor y clases Tailwind.
 */

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
  const s = width ?? size

  // Clases de color según mode (SSR-safe, solo Tailwind)
  const colorClass = mode === 'light' 
    ? 'text-slate-900' 
    : mode === 'dark' 
    ? 'text-white' 
    : 'text-slate-900 dark:text-white'

  // Estilos inline para CSS mask
  const inlineStyle: React.CSSProperties = {
    width: `${s}px`,
    height: `${s}px`,
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
    ...(animated ? { animation: 'vant-pulse 2s ease-in-out infinite' } : {}),
  }

  // Combinar clases
  const finalClassName = className ? `${colorClass} ${className}` : colorClass

  return (
    <span
      role="img"
      aria-label={ariaLabel}
      className={finalClassName}
      style={inlineStyle}
    />
  )
}
