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
      <div className="w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center">
        <VantMark size={64} mode={mode} animated={animated} className="w-full h-full object-contain" aria-label="VANT" />
      </div>
    </div>
  )
}
