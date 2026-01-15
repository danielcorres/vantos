/**
 * Función utilitaria para obtener estado de motivación psicológica
 */
export type MotivationState = {
  level: 'inactive' | 'starting' | 'almost' | 'expected' | 'high'
  color: string
  message: string
}

export function getDailyMotivationState(points: number, target: number): MotivationState {
  if (points < 10) {
    return {
      level: 'inactive',
      color: 'gray',
      message: 'Una acción cambia el día.',
    }
  }

  if (points < target * 0.7) {
    return {
      level: 'starting',
      color: 'orange',
      message: 'Ya estás en movimiento.',
    }
  }

  if (points < target) {
    return {
      level: 'almost',
      color: 'yellow',
      message: `A ${target - points} pts del día esperado.`,
    }
  }

  if (points < target * 1.4) {
    return {
      level: 'expected',
      color: 'green',
      message: 'Día bien hecho. Cumpliste lo esperado.',
    }
  }

  return {
    level: 'high',
    color: 'purple',
    message: 'Día de alto rendimiento.',
  }
}
