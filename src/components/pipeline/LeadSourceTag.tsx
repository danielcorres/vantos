import { chipBase, chipSizeSm, chipTint } from '../../shared/utils/chips'

/** Clave interna tras normalizar el string de BD. */
type SourceKey = 'referido' | 'mercado_natural' | 'frio_canal' | 'redes_sociales' | 'otros' | 'none'

type SourceVisual = {
  displayLabel: string
  compactLabel: string
  fullClassName: string
  compactClassName: string
}

/** Misma familia de color en claro/oscuro (detalle vs lista/Kanban). */
const SOURCE_BY_KEY: Record<Exclude<SourceKey, 'none'>, SourceVisual> = {
  referido: {
    displayLabel: 'Referido',
    compactLabel: 'Referido',
    fullClassName:
      'bg-emerald-50 border-emerald-200/80 text-emerald-900 dark:bg-emerald-950/45 dark:border-emerald-700/55 dark:text-emerald-100',
    compactClassName:
      'bg-emerald-50 border-emerald-200/80 text-emerald-900 dark:bg-emerald-950/45 dark:border-emerald-700/55 dark:text-emerald-100',
  },
  mercado_natural: {
    displayLabel: 'Mercado natural',
    compactLabel: 'Natural',
    fullClassName:
      'bg-amber-50 border-amber-200/80 text-amber-900 dark:bg-amber-950/40 dark:border-amber-700/55 dark:text-amber-100',
    compactClassName:
      'bg-amber-50 border-amber-200/80 text-amber-900 dark:bg-amber-950/40 dark:border-amber-700/55 dark:text-amber-100',
  },
  frio_canal: {
    displayLabel: 'Frío',
    compactLabel: 'Frío',
    fullClassName:
      'bg-sky-50 border-sky-200/80 text-sky-900 dark:bg-sky-950/45 dark:border-sky-700/55 dark:text-sky-100',
    compactClassName:
      'bg-sky-50 border-sky-200/80 text-sky-900 dark:bg-sky-950/45 dark:border-sky-700/55 dark:text-sky-100',
  },
  redes_sociales: {
    displayLabel: 'Redes sociales',
    compactLabel: 'Redes',
    fullClassName:
      'bg-violet-50 border-violet-200/80 text-violet-900 dark:bg-violet-950/45 dark:border-violet-700/55 dark:text-violet-100',
    compactClassName:
      'bg-violet-50 border-violet-200/80 text-violet-900 dark:bg-violet-950/45 dark:border-violet-700/55 dark:text-violet-100',
  },
  otros: {
    displayLabel: 'Otros',
    compactLabel: 'Otros',
    fullClassName:
      'bg-neutral-50 border-neutral-200/80 text-neutral-800 dark:bg-neutral-900/60 dark:border-neutral-600/80 dark:text-neutral-200',
    compactClassName:
      'bg-neutral-50 border-neutral-200/80 text-neutral-700 dark:bg-neutral-900/60 dark:border-neutral-600/80 dark:text-neutral-200',
  },
}

const COMPACT_CHIP =
  'inline-flex items-center max-w-full truncate rounded-full border font-semibold text-[11px] leading-tight px-2 py-0.5 shrink-0'

/**
 * Tag de fuente normalizada (case-insensitive).
 * Mantener la lógica aquí evita duplicados entre Tabla (desktop) y Cards (mobile).
 */
function normalizeLeadSource(source: string | null | undefined): SourceKey {
  const s = (source ?? '').trim().toLowerCase()
  if (!s) return 'none'
  if (s.includes('refer')) return 'referido'
  if (s.includes('mercado') || s.includes('natural')) return 'mercado_natural'
  if (s.includes('frio') || s.includes('frío') || s.includes('cold')) return 'frio_canal'
  if (
    s.includes('social') ||
    s.includes('media') ||
    s.includes('redes') ||
    s.includes('instagram') ||
    s.includes('facebook') ||
    s.includes('tiktok') ||
    s.includes('linkedin') ||
    s.includes('youtube')
  ) {
    return 'redes_sociales'
  }
  return 'otros'
}

export function LeadSourceTag({
  source,
  abbreviated = false,
  className = '',
}: {
  source: string | null | undefined
  /** Si true, muestra etiqueta compacta con el mismo sistema de color que el chip completo. */
  abbreviated?: boolean
  className?: string
}) {
  const key = normalizeLeadSource(source)
  if (key === 'none') {
    return abbreviated ? null : (
      <span
        className={`${chipBase} ${chipSizeSm} ${chipTint.graySoft} dark:bg-neutral-900/50 dark:border-neutral-600 dark:text-neutral-400 ${className}`}
      >
        —
      </span>
    )
  }

  const vis = SOURCE_BY_KEY[key]

  if (abbreviated) {
    return (
      <span
        className={`${COMPACT_CHIP} ${vis.compactClassName} ${className}`}
        title={vis.displayLabel}
      >
        {vis.compactLabel}
      </span>
    )
  }

  return (
    <span className={`${chipBase} ${chipSizeSm} ${vis.fullClassName} ${className}`}>{vis.displayLabel}</span>
  )
}
