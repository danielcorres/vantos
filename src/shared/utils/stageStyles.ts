/**
 * Estilos centralizados por etapa (enterprise, pastel).
 * Resolución por slug para que cambios de nombre en DB no afecten colores.
 * Chips: pill rounded-full px-2 py-0.5 text-xs ring-1 + paleta pastel.
 * Borde/header: getStageAccentStyle(slug), getStageHeaderStyle(slug).
 */

export type StageSlug =
  | 'contactos_nuevos'
  | 'citas_agendadas'
  | 'casos_abiertos'
  | 'citas_cierre'
  | 'solicitudes_ingresadas'
  | 'casos_ganados'

/** Chip: paleta pastel por slug. Fallback gris si slug no coincide. */
const SLUG_CHIP_CLASSES: Record<StageSlug, string> = {
  contactos_nuevos:
    'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-100 dark:ring-sky-700/60',
  citas_agendadas:
    'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/45 dark:text-amber-100 dark:ring-amber-700/55',
  casos_abiertos:
    'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-100 dark:ring-indigo-700/55',
  citas_cierre:
    'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-950/45 dark:text-orange-100 dark:ring-orange-700/55',
  solicitudes_ingresadas:
    'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-100 dark:ring-violet-700/55',
  casos_ganados:
    'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/45 dark:text-emerald-100 dark:ring-emerald-700/55',
}

/** Colores de acento (borde/barra) — tonos 200 por slug */
const SLUG_ACCENT_COLORS: Record<StageSlug, string> = {
  contactos_nuevos: 'rgb(186 230 253)',     // sky-200
  citas_agendadas: 'rgb(253 230 138)',     // amber-200
  casos_abiertos: 'rgb(199 210 254)',       // indigo-200
  citas_cierre: 'rgb(254 215 170)',        // orange-200
  solicitudes_ingresadas: 'rgb(221 214 254)', // violet-200
  casos_ganados: 'rgb(167 243 208)',       // emerald-200
}

const CHIP_BASE = 'inline-block rounded-full px-2 py-0.5 text-xs ring-1'
const DEFAULT_ACCENT = 'rgb(226 232 240)' // slate-200

function isKnownSlug(slug: string | undefined): slug is StageSlug {
  return (
    slug === 'contactos_nuevos' ||
    slug === 'citas_agendadas' ||
    slug === 'casos_abiertos' ||
    slug === 'citas_cierre' ||
    slug === 'solicitudes_ingresadas' ||
    slug === 'casos_ganados'
  )
}

/** Clases para chip de etapa. Recibe slug (no name). */
export function getStageTagClasses(stageSlug: string | undefined): string {
  const slug = (stageSlug ?? '').trim()
  if (!isKnownSlug(slug)) {
    return `${CHIP_BASE} bg-slate-50 text-slate-600 ring-slate-200 dark:bg-slate-800/70 dark:text-slate-200 dark:ring-slate-600/80`
  }
  return `${CHIP_BASE} ${SLUG_CHIP_CLASSES[slug]}`
}

/** Estilo para borde izquierdo en filas. Recibe slug. */
export function getStageAccentStyle(stageSlug: string | undefined): {
  borderLeftWidth: number
  borderLeftStyle: 'solid'
  borderLeftColor: string
} {
  const slug = (stageSlug ?? '').trim()
  const color = isKnownSlug(slug) ? SLUG_ACCENT_COLORS[slug] : DEFAULT_ACCENT
  return { borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: color }
}

/** Estilo para header de sección (acordeón). Recibe slug. */
export function getStageHeaderStyle(stageSlug: string | undefined): {
  borderLeftWidth: number
  borderLeftStyle: 'solid'
  borderLeftColor: string
  paddingLeft: number
} {
  const slug = (stageSlug ?? '').trim()
  const color = isKnownSlug(slug) ? SLUG_ACCENT_COLORS[slug] : DEFAULT_ACCENT
  return { borderLeftWidth: 4, borderLeftStyle: 'solid', borderLeftColor: color, paddingLeft: 12 }
}

/** Etiqueta visual: devuelve el name tal cual (el name viene de DB y ya es el texto deseado). */
export function displayStageName(stageName: string | undefined): string {
  if (!stageName || typeof stageName !== 'string') return '—'
  return stageName.trim() || '—'
}
