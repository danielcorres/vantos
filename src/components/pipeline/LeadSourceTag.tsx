import { chipBase, chipSizeSm, chipTint } from '../../shared/utils/chips'

/**
 * Tag de fuente normalizada (case-insensitive).
 * Mantener la lógica aquí evita duplicados entre Tabla (desktop) y Cards (mobile).
 */
export function normalizeLeadSource(source: string | null | undefined): 'Frío' | 'Referido' | 'Mercado Natural' | 'Otros' | '—' {
  const s = (source ?? '').trim().toLowerCase()
  if (!s) return '—'
  if (s.includes('refer')) return 'Referido'
  if (s.includes('mercado') || s.includes('natural')) return 'Mercado Natural'
  if (s.includes('frio') || s.includes('frío') || s.includes('cold')) return 'Frío'
  return 'Otros'
}

export function LeadSourceTag({
  source,
  className = '',
}: {
  source: string | null | undefined
  className?: string
}) {
  const label = normalizeLeadSource(source)
  if (label === '—') {
    return <span className={`${chipBase} ${chipSizeSm} ${chipTint.graySoft} ${className}`}>—</span>
  }

  const tint =
    label === 'Referido'
      ? chipTint.greenSoft
      : label === 'Mercado Natural'
        ? chipTint.amberSoft
        : chipTint.neutral

  return <span className={`${chipBase} ${chipSizeSm} ${tint} ${className}`}>{label}</span>
}
