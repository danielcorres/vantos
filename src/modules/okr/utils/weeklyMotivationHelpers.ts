/**
 * Función utilitaria para obtener mensaje motivacional semanal
 * Blindaje defensivo: nunca retorna NaN o valores inválidos
 */
export function getWeeklyMotivationMessage(progressPercent: number): {
  message: string
  color: string
  icon?: string
} {
  // Sanitizar entrada
  const safePercent = Number.isFinite(progressPercent) && progressPercent >= 0
    ? progressPercent
    : 0

  // Si no hay progreso (0%), mensaje específico
  if (safePercent === 0) {
    return {
      message: 'Empieza a registrar tu actividad esta semana',
      color: 'text-gray-500',
    }
  }

  if (safePercent < 80) {
    return {
      message: 'Semana en construcción',
      color: 'text-gray-600',
    }
  }

  if (safePercent < 100) {
    return {
      message: 'Vas en camino',
      color: 'text-yellow-600',
    }
  }

  if (safePercent < 120) {
    return {
      message: 'Semana sólida ✅',
      color: 'text-green-600',
      icon: '✅',
    }
  }

  return {
    message: 'Semana de alto rendimiento 🔥',
    color: 'text-purple-600',
    icon: '🔥',
  }
}
