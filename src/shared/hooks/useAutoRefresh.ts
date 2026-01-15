import { useEffect, useRef, useCallback } from 'react'

type UseAutoRefreshOptions = {
  debounceMs?: number
  enabled?: boolean
}

/**
 * Hook para auto-refresh al hacer focus en la ventana o cuando el documento se vuelve visible
 * @param refetch - Función async para refetch de datos
 * @param options - Opciones de configuración
 */
export function useAutoRefresh(
  refetch: () => Promise<void>,
  options: UseAutoRefreshOptions = {}
) {
  const { debounceMs = 2000, enabled = true } = options
  const lastFetchRef = useRef<number>(0)
  const timeoutRef = useRef<number | null>(null)
  const refetchRef = useRef(refetch)

  // Mantener refetch actualizado
  useEffect(() => {
    refetchRef.current = refetch
  }, [refetch])

  const executeRefetch = useCallback(() => {
    const now = Date.now()
    const timeSinceLastFetch = now - lastFetchRef.current

    // Debounce: no ejecutar si ya se ejecutó hace menos de debounceMs
    if (timeSinceLastFetch < debounceMs) {
      return
    }

    // Limpiar timeout previo si existe
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    // Ejecutar después del debounce
    timeoutRef.current = window.setTimeout(() => {
      refetchRef.current()
        .then(() => {
          lastFetchRef.current = Date.now()
        })
        .catch((error) => {
          console.warn('Auto-refresh failed:', error)
          // No propagar el error, solo loguear
        })
    }, Math.max(0, debounceMs - timeSinceLastFetch))
  }, [debounceMs])

  useEffect(() => {
    if (!enabled) return

    const handleFocus = () => {
      executeRefetch()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        executeRefetch()
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [enabled, executeRefetch])
}
