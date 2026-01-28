/**
 * Devuelve className pastel para tag de fuente (Referido, Mercado natural, Frío, Social, etc.)
 */
export function getSourceTag(source: string | null | undefined): string {
  if (!source || typeof source !== 'string') {
    return 'bg-neutral-100 text-neutral-600'
  }
  const s = source.trim().toLowerCase()
  if (s.includes('referido')) return 'bg-violet-100 text-violet-600'
  if (s.includes('natural') || s.includes('mercado')) return 'bg-emerald-100 text-emerald-600'
  if (s.includes('frío') || s.includes('frio')) return 'bg-sky-100 text-sky-600'
  if (s.includes('social') || s.includes('redes')) return 'bg-amber-100 text-amber-600'
  return 'bg-neutral-100 text-neutral-600'
}
