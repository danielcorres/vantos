/**
 * Sistema de chips unificado: tint suave + borde suave + texto oscuro.
 * Uso: chipBase + chipSizeSm + chipTint.*
 */

export const chipBase =
  'inline-flex items-center gap-1 rounded-full border font-medium leading-none shrink-0'

export const chipSizeSm = 'text-[12px] px-2.5 py-[5px]'

/** Variantes de tint */
export const chipTint = {
  neutral: 'bg-neutral-50 border-neutral-200/70 text-neutral-700',
  neutralDim: 'bg-neutral-50 border-neutral-200/60 text-neutral-600',
  greenSoft: 'bg-emerald-50 border-emerald-200/60 text-emerald-800',
  greenStrong: 'bg-emerald-100 border-emerald-200/70 text-emerald-900',
  graySoft: 'bg-neutral-50 border-neutral-200 text-neutral-500',
  redSoft: 'bg-red-50 border-red-200/60 text-red-800',
  amberSoft: 'bg-amber-50 border-amber-200/60 text-amber-800',
} as const

/** Chip completo small neutral (más usado) */
export const chipSm = `${chipBase} ${chipSizeSm} ${chipTint.neutral}`

/** Chip completo con hover para botones */
export const chipSmClickable = `${chipSm} cursor-pointer hover:bg-neutral-100/60 transition-colors`
