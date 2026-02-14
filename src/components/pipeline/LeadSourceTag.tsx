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
    return <span className={`text-xs text-neutral-400 ${className}`}>—</span>
  }

  const base = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1'
  const styles =
    label === 'Referido'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
      : label === 'Mercado Natural'
        ? 'bg-amber-50 text-amber-800 ring-amber-100'
        : label === 'Frío'
          ? 'bg-sky-50 text-sky-700 ring-sky-100'
          : 'bg-neutral-100 text-neutral-700 ring-neutral-100'

  return <span className={`${base} ${styles} ${className}`}>{label}</span>
}
