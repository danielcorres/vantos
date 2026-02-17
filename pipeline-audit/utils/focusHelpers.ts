// Helper functions for Focus page

export type FocusItem = {
  lead_id: string
  lead_name: string | null
  stage_id: string | null
  stage_name: string | null
  sla_status: 'breach' | 'warn' | 'ok' | 'none' | null
  days_in_stage: number | null
  entered_stage_at: string | null
  last_activity_at: string | null
  priority_score: number | null
  reason: string | null
  sla_days_left: number | null
  sla_due_at: string | null
  last_stage_moved_at: string | null
}

export type FocusCounts = {
  total: number
  overdue: number
  warn: number
  ok: number
  none: number
}

/**
 * Normalizes raw RPC response to FocusItem shape
 * Handles alternative key names for robustness
 */
export function normalizeFocusItem(raw: unknown): FocusItem {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid focus item data')
  }

  const item = raw as Record<string, unknown>

  return {
    lead_id: (item.lead_id || item.id || '') as string,
    lead_name:
      (item.lead_name || item.name || item.full_name || null) as string | null,
    stage_id: (item.stage_id || null) as string | null,
    stage_name:
      (item.stage_name || item.current_stage_name || null) as string | null,
    sla_status:
      (item.sla_status || item.status || null) as
        | 'breach'
        | 'warn'
        | 'ok'
        | 'none'
        | null,
    days_in_stage: (item.days_in_stage || null) as number | null,
    entered_stage_at: (item.entered_stage_at || null) as string | null,
    last_activity_at: (item.last_activity_at || null) as string | null,
    priority_score: (item.priority_score || null) as number | null,
    reason: (item.reason || null) as string | null,
    sla_days_left:
      (item.sla_days_left || item.days_left || null) as number | null,
    sla_due_at: (item.sla_due_at || item.due_at || null) as string | null,
    last_stage_moved_at:
      (item.last_stage_moved_at || item.last_moved_at || null) as string | null,
  }
}

/**
 * Counts items by SLA status
 */
export function countByStatus(items: FocusItem[]): FocusCounts {
  return items.reduce(
    (acc, item) => {
      acc.total++
      const status = item.sla_status || 'none'
      if (status === 'breach') acc.overdue++
      else if (status === 'warn') acc.warn++
      else if (status === 'ok') acc.ok++
      else acc.none++
      return acc
    },
    { total: 0, overdue: 0, warn: 0, ok: 0, none: 0 }
  )
}

/**
 * Sorts items by priority (overdue first, then warn, then ok, then none)
 * Uses priority_score and sla_due_at as tiebreakers
 */
export function sortByPriority(items: FocusItem[]): FocusItem[] {
  return [...items].sort((a, b) => {
    // Priority order: breach > warn > ok > none
    const statusOrder: Record<string, number> = {
      breach: 0,
      warn: 1,
      ok: 2,
      none: 3,
    }
    const aStatus = a.sla_status || 'none'
    const bStatus = b.sla_status || 'none'
    const aOrder = statusOrder[aStatus] ?? 3
    const bOrder = statusOrder[bStatus] ?? 3

    if (aOrder !== bOrder) {
      return aOrder - bOrder
    }

    // Same status: use priority_score (lower is better)
    const aScore = a.priority_score ?? 9999
    const bScore = b.priority_score ?? 9999
    if (aScore !== bScore) {
      return aScore - bScore
    }

    // Same score: use sla_due_at (closer first)
    if (a.sla_due_at && b.sla_due_at) {
      return new Date(a.sla_due_at).getTime() - new Date(b.sla_due_at).getTime()
    }
    if (a.sla_due_at) return -1
    if (b.sla_due_at) return 1

    return 0
  })
}

/**
 * Filters items by status filter
 */
export function filterByStatus(
  items: FocusItem[],
  filter: 'all' | 'overdue' | 'warn' | 'ok'
): FocusItem[] {
  if (filter === 'all') return items
  if (filter === 'overdue') return items.filter((i) => i.sla_status === 'breach')
  if (filter === 'warn') return items.filter((i) => i.sla_status === 'warn')
  if (filter === 'ok') return items.filter((i) => i.sla_status === 'ok')
  return items
}

/**
 * Filters items by search text (searches in lead_name)
 */
export function filterBySearch(
  items: FocusItem[],
  searchText: string
): FocusItem[] {
  if (!searchText.trim()) return items
  const lower = searchText.toLowerCase()
  return items.filter((item) =>
    (item.lead_name || '').toLowerCase().includes(lower)
  )
}

/**
 * Formats date for display
 */
export function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return 'N/A'
  }
}

/**
 * Formats date with time for display
 */
export function formatDateTime(dateString: string | null): string {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'N/A'
  }
}
