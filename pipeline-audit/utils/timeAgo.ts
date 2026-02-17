/**
 * Formatea una fecha como tiempo relativo en español (es-MX)
 * Ej: "hace 10s", "hace 3m", "hace 2h", etc.
 */
export function timeAgo(date: Date | string | number): string {
  const now = new Date()
  const past = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date
  const diffMs = now.getTime() - past.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 10) {
    return 'hace unos segundos'
  }

  if (diffSeconds < 60) {
    return `hace ${diffSeconds}s`
  }

  if (diffMinutes < 60) {
    return `hace ${diffMinutes}m`
  }

  if (diffHours < 24) {
    return `hace ${diffHours}h`
  }

  if (diffDays === 1) {
    return 'hace 1 día'
  }

  if (diffDays < 7) {
    return `hace ${diffDays} días`
  }

  // Si es más de una semana, mostrar fecha formateada
  return past.toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
