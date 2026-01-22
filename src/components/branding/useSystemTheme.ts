import { useState, useEffect } from 'react'

/**
 * Hook para detectar el tema del sistema.
 * Prioridad:
 * 1. Si existe <html class="dark"> => dark
 * 2. Si no, usar prefers-color-scheme
 * En SSR (cuando window no existe), retorna 'light' por defecto.
 */
export function useSystemTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    // SSR: si window no existe, default a light
    if (typeof window === 'undefined') return 'light'
    
    // Prioridad 1: Detectar html.dark
    if (document.documentElement.classList.contains('dark')) {
      return 'dark'
    }
    
    // Prioridad 2: Detectar tema del sistema
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    return mediaQuery.matches ? 'dark' : 'light'
  })

  useEffect(() => {
    // Si window no existe, no hacer nada (SSR)
    if (typeof window === 'undefined') return

    // Función para detectar tema actual
    const detectTheme = (): 'light' | 'dark' => {
      // Prioridad 1: html.dark
      if (document.documentElement.classList.contains('dark')) {
        return 'dark'
      }
      // Prioridad 2: prefers-color-scheme
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      return mediaQuery.matches ? 'dark' : 'light'
    }

    // Detectar tema inicial
    setTheme(detectTheme())

    // Observar cambios en html.dark
    const observer = new MutationObserver(() => {
      setTheme(detectTheme())
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })

    // Escuchar cambios en prefers-color-scheme
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      setTheme(detectTheme())
    }

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange)
      return () => {
        observer.disconnect()
        mediaQuery.removeEventListener('change', handleChange)
      }
    } else {
      // Fallback para navegadores antiguos
      mediaQuery.addListener(handleChange)
      return () => {
        observer.disconnect()
        mediaQuery.removeListener(handleChange)
      }
    }
  }, [])

  return theme
}
