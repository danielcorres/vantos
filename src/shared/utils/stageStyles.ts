/**
 * Estilos centralizados por etapa (enterprise, suaves).
 * Usar en: chips de etapa (Pipeline y Detalle), borde izquierdo en filas.
 *
 * Chips: pill rounded-full px-2 py-0.5 text-xs ring-1 + colores.
 * Borde: getStageAccentStyle(stageName) → { borderLeftColor } para border-left.
 *
 * Consistencia: "Propuesta" y "Propuesta presentada" comparten el mismo estilo (tag + accent).
 * "Cerrado ganado" y "Cerrado perdido" tienen estilos suaves y distintos (emerald / rose).
 */

const STAGE_MAP: Record<string, string> = {
  'Nuevo': 'bg-neutral-100 text-neutral-700 ring-neutral-200',
  'Contactado': 'bg-sky-100 text-sky-800 ring-sky-200',
  'Cita agendada': 'bg-blue-100 text-blue-800 ring-blue-200',
  'Cita realizada': 'bg-green-100 text-green-800 ring-green-200',
  'Propuesta': 'bg-amber-100 text-amber-800 ring-amber-200',
  'Propuesta presentada': 'bg-amber-100 text-amber-800 ring-amber-200',
  'Cerrado ganado': 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  'Cerrado perdido': 'bg-rose-100 text-rose-800 ring-rose-200',
}

const CHIP_BASE = 'inline-block rounded-full px-2 py-0.5 text-xs ring-1'

function matchStageName(name: string): string | null {
  if (!name || typeof name !== 'string') return null
  const n = name.trim()
  if (STAGE_MAP[n]) return n
  const lower = n.toLowerCase()
  if (lower.includes('nuevo')) return 'Nuevo'
  if (lower.includes('contactado')) return 'Contactado'
  if (lower.includes('cita') && lower.includes('agendada')) return 'Cita agendada'
  if (lower.includes('cita') && lower.includes('realizada')) return 'Cita realizada'
  if (lower === 'propuesta' || lower.includes('propuesta presentada')) return 'Propuesta'
  if (lower.includes('cerrado') && lower.includes('ganado')) return 'Cerrado ganado'
  if (lower.includes('cerrado') && lower.includes('perdido')) return 'Cerrado perdido'
  return null
}

/** Clases para chip de etapa: pill rounded-full px-2 py-0.5 text-xs ring-1 + colores suaves */
export function getStageTagClasses(stageName: string | undefined): string {
  const key = matchStageName(stageName ?? '')
  if (!key) return `${CHIP_BASE} bg-neutral-100 text-neutral-600 ring-neutral-200`
  const classes = STAGE_MAP[key]
  return `${CHIP_BASE} ${classes}`
}

/** Estilo para borde izquierdo sutil en filas. Usar como style={getStageAccentStyle(name)} */
export function getStageAccentStyle(stageName: string | undefined): { borderLeftWidth: number; borderLeftStyle: 'solid'; borderLeftColor: string } {
  const key = matchStageName(stageName ?? '')
  const colors: Record<string, string> = {
    'Nuevo': 'rgb(212 212 212)',
    'Contactado': 'rgb(125 211 252)',
    'Cita agendada': 'rgb(147 197 253)',
    'Cita realizada': 'rgb(134 239 172)',
    'Propuesta': 'rgb(253 230 138)',
    'Propuesta presentada': 'rgb(253 230 138)',
    'Cerrado ganado': 'rgb(167 243 208)',
    'Cerrado perdido': 'rgb(254 205 211)',
  }
  const color = key ? colors[key] ?? 'rgb(212 212 212)' : 'rgb(212 212 212)'
  return { borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: color }
}
