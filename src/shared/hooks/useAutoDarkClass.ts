import { useEffect } from 'react'

/**
 * Sincroniza la clase `dark` en <html> con prefers-color-scheme.
 * (Hoy la app fuerza tema claro en App.tsx; este hook queda por si se reactiva.)
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
