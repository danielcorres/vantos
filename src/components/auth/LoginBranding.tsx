/**
 * Branding para pantallas de login/auth.
 * Usa VantLogo (wordmark completo).
 */

import { VantLogo } from '../branding/VantLogo'

type LoginBrandingProps = {
  mode?: 'light' | 'dark' | 'auto'
  animated?: boolean
  className?: string
}

export function LoginBranding({ mode = 'dark', animated = false, className = '' }: LoginBrandingProps) {
  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <VantLogo size={64} mode={mode} animated={animated} className="mx-auto" aria-label="vant" />
    </div>
  )
}
