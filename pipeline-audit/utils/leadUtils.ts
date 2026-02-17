/**
 * Indica si un lead probablemente nunca ha sido movido de etapa.
 * Pragmático: stage_changed_at === created_at o diferencia < 1 min.
 * No requiere consultar lead_stage_history.
 */
export function isLikelyNeverMoved(lead: {
  created_at: string
  stage_changed_at?: string | null
}): boolean {
  const changed = lead.stage_changed_at ?? lead.created_at
  if (lead.stage_changed_at == null) return false
  if (changed === lead.created_at) return true
  const diffMs = Math.abs(
    new Date(changed).getTime() - new Date(lead.created_at).getTime()
  )
  return diffMs < 60 * 1000
}
