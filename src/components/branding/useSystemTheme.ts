import { useState, useEffect } from 'react'

/**
 * Hook para detectar el tema del sistema (prefers-color-scheme).
 * Retorna 'dark' si el sistema prefiere dark, 'light' en caso contrario.
 * En SSR (cuando window no existe), retorna 'light' por defecto.
 */
export function useSystemTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    // SSR: si window no existe, default a light
    if (typeof window === 'undefined') return 'light'
    
    // Detectar tema inicial
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    return mediaQuery.matches ? 'dark' : 'light'
  })

  useEffect(() => {
    // Si window no existe, no hacer nada (SSR)
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = (e: MediaQueryListEvent) => {
      setTheme(e.matches ? 'dark' : 'light')
    }

    // Escuchar cambios
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    } else {
      // Fallback para navegadores antiguos
      mediaQuery.addListener(handleChange)
      return () => mediaQuery.removeListener(handleChange)
    }
  }, [])

  return theme
}
