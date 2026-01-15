/**
 * Helper para detectar errores de red/auth de Supabase
 */
export function isNetworkError(error: unknown): boolean {
  if (!error) return false

  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorString = errorMessage.toLowerCase()

  // Errores comunes de red
  if (
    errorString.includes('failed to fetch') ||
    errorString.includes('network error') ||
    errorString.includes('networkerror') ||
    errorString.includes('fetch failed')
  ) {
    return true
  }

  // Errores de Supabase no disponible
  if (
    errorString.includes('503') ||
    errorString.includes('service unavailable') ||
    errorString.includes('connection refused')
  ) {
    return true
  }

  return false
}

/**
 * Helper para detectar errores de autenticación
 */
export function isAuthError(error: unknown): boolean {
  if (!error) return false

  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorString = errorMessage.toLowerCase()

  if (
    errorString.includes('jwt') ||
    errorString.includes('token') ||
    errorString.includes('unauthorized') ||
    errorString.includes('401') ||
    errorString.includes('not authenticated')
  ) {
    return true
  }

  return false
}

/**
 * Obtener mensaje de error amigable
 */
export function getErrorMessage(error: unknown): string {
  if (!error) return 'Error desconocido'

  if (isNetworkError(error)) {
    return 'Supabase local no responde. Corre: supabase start'
  }

  if (isAuthError(error)) {
    return 'Error de autenticación. Por favor, recarga la página.'
  }

  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}
