/**
 * Branding para pantallas de login/auth.
 * Usa VantMark en todos los tamaños.
 */

import { VantMark } from '../branding/VantMark'

type LoginBrandingProps = {
  mode?: 'light' | 'dark' | 'auto'
  animated?: boolean
  className?: string
}

export function LoginBranding({ mode = 'auto', animated = false, className = '' }: LoginBrandingProps) {
  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <VantMark size={80} mode={mode} animated={animated} aria-label="VANT" />
    </div>
  )
}
