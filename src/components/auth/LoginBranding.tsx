/**
 * Branding para pantallas de login/auth.
 * Mobile: VantMark. Desktop: VantLogo.
 */

import { VantLogo } from '../branding/VantLogo'
import { VantMark } from '../branding/VantMark'

type LoginBrandingProps = {
  mode?: 'light' | 'dark' | 'auto'
  animated?: boolean
  className?: string
}

export function LoginBranding({ mode = 'auto', animated = false, className = '' }: LoginBrandingProps) {
  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <div className="md:hidden" aria-hidden>
        <VantMark size={80} mode={mode} animated={animated} aria-label="VANT" />
      </div>
      <div className="hidden md:block" aria-hidden>
        <VantLogo size={140} mode={mode} animated={animated} aria-label="VANT login logo" />
      </div>
    </div>
  )
}
