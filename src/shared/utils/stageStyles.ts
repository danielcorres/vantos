/**
 * Estilos centralizados por etapa (enterprise, pastel).
 * Chips: pill rounded-full px-2 py-0.5 text-xs ring-1 + paleta pastel (bg-*-50, text-*-700, ring-*-200).
 * Borde filas: getStageAccentStyle(name).
 * Header de sección: getStageHeaderStyle(name) → barra izquierda + padding.
 *
 * Consistencia: "Propuesta" y "Propuesta presentada" comparten el mismo estilo (tag + accent).
 */

const STAGE_MAP: Record<string, string> = {
  'Nuevo': 'bg-slate-50 text-slate-700 ring-slate-200',
  'Contactado': 'bg-sky-50 text-sky-700 ring-sky-200',
  'Cita agendada': 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  'Cita realizada': 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  'Propuesta': 'bg-amber-50 text-amber-700 ring-amber-200',
  'Propuesta presentada': 'bg-amber-50 text-amber-700 ring-amber-200',
  'Cerrado ganado': 'bg-teal-50 text-teal-700 ring-teal-200',
  'Cerrado perdido': 'bg-rose-50 text-rose-700 ring-rose-200',
}

/** Colores de acento (borde/barra) alineados con la paleta pastel — tonos 200 */
const ACCENT_COLORS: Record<string, string> = {
  'Nuevo': 'rgb(226 232 240)',       // slate-200
  'Contactado': 'rgb(186 230 253)',  // sky-200
  'Cita agendada': 'rgb(199 210 254)', // indigo-200
  'Cita realizada': 'rgb(167 243 208)', // emerald-200
  'Propuesta': 'rgb(253 230 138)',  // amber-200
  'Propuesta presentada': 'rgb(253 230 138)',
  'Cerrado ganado': 'rgb(153 246 228)',  // teal-200
  'Cerrado perdido': 'rgb(254 205 211)', // rose-200
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

/** Clases para chip de etapa: paleta pastel bg-*-50 text-*-700 ring-*-200 */
export function getStageTagClasses(stageName: string | undefined): string {
  const key = matchStageName(stageName ?? '')
  if (!key) return `${CHIP_BASE} bg-slate-50 text-slate-600 ring-slate-200`
  const classes = STAGE_MAP[key]
  return `${CHIP_BASE} ${classes}`
}

/** Estilo para borde izquierdo sutil en filas. Mismo color family que chips. */
export function getStageAccentStyle(stageName: string | undefined): { borderLeftWidth: number; borderLeftStyle: 'solid'; borderLeftColor: string } {
  const key = matchStageName(stageName ?? '')
  const color = key ? ACCENT_COLORS[key] ?? ACCENT_COLORS['Nuevo'] : ACCENT_COLORS['Nuevo']
  return { borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: color }
}

/** Estilo para header de sección (acordeón): barra izquierda 4px + padding. Enterprise, mismo color que filas. */
export function getStageHeaderStyle(stageName: string | undefined): { borderLeftWidth: number; borderLeftStyle: 'solid'; borderLeftColor: string; paddingLeft: number } {
  const key = matchStageName(stageName ?? '')
  const color = key ? ACCENT_COLORS[key] ?? ACCENT_COLORS['Nuevo'] : ACCENT_COLORS['Nuevo']
  return { borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: color, paddingLeft: 12 }
}
