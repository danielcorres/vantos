import { useEffect } from 'react'

/**
 * Sincroniza la clase `dark` en <html> con prefers-color-scheme.
 * Una sola llamada global (ej. en App). Sin state ni settings.
 */
export function useAutoDarkClass() {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')

    const apply = () => {
      document.documentElement.classList.toggle('dark', mq.matches)
    }

    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
}
