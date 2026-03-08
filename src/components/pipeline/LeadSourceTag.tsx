import { chipBase, chipSizeSm, chipTint } from '../../shared/utils/chips'

type SourceLabel = 'Frío' | 'Referido' | 'Mercado Natural' | 'Social media' | 'Otros' | '—'

/**
 * Tag de fuente normalizada (case-insensitive).
 * Mantener la lógica aquí evita duplicados entre Tabla (desktop) y Cards (mobile).
 */
function normalizeLeadSource(source: string | null | undefined): SourceLabel {
  const s = (source ?? '').trim().toLowerCase()
  if (!s) return '—'
  if (s.includes('refer')) return 'Referido'
  if (s.includes('mercado') || s.includes('natural')) return 'Mercado Natural'
  if (s.includes('frio') || s.includes('frío') || s.includes('cold')) return 'Frío'
  if (s.includes('social') || s.includes('media')) return 'Social media'
  return 'Otros'
}

const SOURCE_ABBREV: Record<SourceLabel, string> = {
  Referido: 'R',
  'Mercado Natural': 'MN',
  Frío: 'F',
  'Social media': 'SM',
  Otros: 'O',
  '—': '—',
}

export function LeadSourceTag({
  source,
  abbreviated = false,
  className = '',
}: {
  source: string | null | undefined
  /** Si true, muestra abreviación: R, MN, F, SM, O (sin ocupar segunda línea). */
  abbreviated?: boolean
  className?: string
}) {
  const label = normalizeLeadSource(source)
  if (label === '—') {
    return abbreviated ? null : <span className={`${chipBase} ${chipSizeSm} ${chipTint.graySoft} ${className}`}>—</span>
  }

  const abbrev = SOURCE_ABBREV[label]
  if (abbreviated) {
    return (
      <span
        className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-600 ${className}`}
        title={label}
      >
        {abbrev}
      </span>
    )
  }

  const tint =
    label === 'Referido'
      ? chipTint.greenSoft
      : label === 'Mercado Natural'
        ? chipTint.amberSoft
        : chipTint.neutral

  return <span className={`${chipBase} ${chipSizeSm} ${tint} ${className}`}>{label}</span>
}
