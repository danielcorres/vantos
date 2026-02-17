/**
 * Próxima acción derivada de etapa + next_follow_up_at.
 * Pipeline muestra SOLO esta fecha; una sola línea "Acción · fecha" o "Acción · sin fecha" o "Cerrado".
 * Mapeo por stage.name (NO por id).
 */

function formatHumanDateShort(dateString: string | null | undefined): string {
  if (!dateString) return ''
  try {
    const date = new Date(dateString)
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    const day = date.getDate()
    const month = months[date.getMonth()]
    return `${day} ${month}`
  } catch {
    return ''
  }
}

function normalizeStageKey(name: string): string | null {
  if (!name || typeof name !== 'string') return null
  const lower = name.trim().toLowerCase()
  if (lower.includes('nuevo')) return 'Nuevo'
  if (lower.includes('contactado')) return 'Contactado'
  if (lower.includes('cita') && lower.includes('agendada')) return 'Cita agendada'
  if (lower.includes('cita') && lower.includes('realizada')) return 'Cita realizada'
  if (lower === 'propuesta' || lower.includes('propuesta presentada')) return 'Propuesta'
  if (lower.includes('cerrado') && lower.includes('ganado')) return 'Cerrado ganado'
  if (lower.includes('cerrado') && lower.includes('perdido')) return 'Cerrado perdido'
  return null
}

export type ProximaLabel = { line: string; colorClass: string; isMuted?: boolean }

/**
 * Función pura: (stageName, next_follow_up_at) → label para columna "Próxima".
 * - Etapa cerrada (ganado/perdido) → solo "Cerrado" (sin fecha).
 * - No cerrada + fecha → "{Acción} · {fecha corta}".
 * - No cerrada + null → "{Acción} · sin fecha" (atenuado).
 */
export function getProximaLabel(
  stageName: string,
  next_follow_up_at: string | null | undefined
): ProximaLabel {
  const key = normalizeStageKey(stageName)
  const fechaCorta = next_follow_up_at ? formatHumanDateShort(next_follow_up_at) : null
  const isCerrada = key === 'Cerrado ganado' || key === 'Cerrado perdido'

  if (isCerrada) {
    return {
      line: 'Cerrado',
      colorClass: key === 'Cerrado ganado' ? 'text-emerald-600' : 'text-rose-600',
    }
  }

  const acciones: Record<string, string> = {
    Nuevo: 'Contactar',
    Contactado: 'Agendar cita',
    'Cita agendada': 'Confirmar cita',
    'Cita realizada': 'Presentar propuesta',
    Propuesta: 'Dar seguimiento',
  }
  const accion = acciones[key ?? ''] ?? 'Dar seguimiento'

  if (fechaCorta) {
    return { line: `${accion} · ${fechaCorta}`, colorClass: 'text-sky-600' }
  }
  return { line: `${accion} · sin fecha`, colorClass: 'text-neutral-600', isMuted: true }
}
