// Helper functions for SLA badges and ordering in Kanban

export type SlaStatus = 'breach' | 'warn' | 'ok' | 'none' | null

export type SlaPill = {
  label: string
  className: string
  style: React.CSSProperties
}

export type ColumnCounts = {
  overdue: number
  warn: number
  ok: number
  none: number
  total: number
}

/**
 * Gets SLA status from a lead row
 * Accepts alternative key names for robustness
 */
export function getSlaStatus(row: unknown): SlaStatus {
  if (!row || typeof row !== 'object') return null
  const lead = row as Record<string, unknown>
  const status = (lead.sla_status || lead.status || lead.sla_state || null) as
    | SlaStatus
    | null
  return status || null
}

/**
 * Gets SLA pill configuration for a lead
 */
export function getSlaPill(row: unknown): SlaPill | null {
  const status = getSlaStatus(row)
  const lead = row as Record<string, unknown>
  const daysLeft = (lead.sla_days_left || lead.days_left || null) as number | null
  const daysInStage = (lead.days_in_stage || null) as number | null

  if (!status || status === 'none') {
    // Return null to hide badge when no SLA
    return null
  }

  if (status === 'breach') {
    return {
      label: `Vencido${daysInStage !== null ? ` (${daysInStage}d)` : ''}`,
      className: 'sla-pill-breach',
      style: {
        background: '#fee',
        color: '#c33',
        border: '1px solid #c33',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: '600',
      },
    }
  }

  if (status === 'warn') {
    return {
      label: `Por vencer${daysLeft !== null ? ` (${daysLeft}d)` : ''}`,
      className: 'sla-pill-warn',
      style: {
        background: '#ffe',
        color: '#c90',
        border: '1px solid #c90',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: '600',
      },
    }
  }

  if (status === 'ok') {
    return {
      label: `En tiempo${daysLeft !== null ? ` (${daysLeft}d)` : ''}`,
      className: 'sla-pill-ok',
      style: {
        background: '#efe',
        color: '#3c3',
        border: '1px solid #3c3',
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '10px',
        fontWeight: '600',
      },
    }
  }

  return null
}

/**
 * Gets rank number for sorting by SLA status
 * Lower number = higher priority
 */
export function getSlaRank(status: SlaStatus): number {
  const rankMap: Record<string, number> = {
    breach: 0,
    warn: 1,
    ok: 2,
    none: 3,
  }
  return rankMap[status || 'none'] ?? 3
}

/**
 * Aggregates SLA counts for a column of leads
 */
export function aggregateColumnCounts(leads: unknown[]): ColumnCounts {
  return leads.reduce<ColumnCounts>(
    (acc, lead) => {
      acc.total++
      const status = getSlaStatus(lead)
      if (status === 'breach') acc.overdue++
      else if (status === 'warn') acc.warn++
      else if (status === 'ok') acc.ok++
      else acc.none++
      return acc
    },
    { overdue: 0, warn: 0, ok: 0, none: 0, total: 0 }
  )
}

/**
 * Sorts leads by SLA urgency (overdue -> warn -> ok -> none)
 * Uses sla_due_at as tiebreaker if available
 */
export function sortLeadsBySla<T extends Record<string, unknown>>(
  leads: T[]
): T[] {
  return [...leads].sort((a, b) => {
    const aStatus = getSlaStatus(a)
    const bStatus = getSlaStatus(b)
    const aRank = getSlaRank(aStatus)
    const bRank = getSlaRank(bStatus)

    if (aRank !== bRank) {
      return aRank - bRank
    }

    // Same status: use sla_due_at (earlier = higher priority)
    const aDueAt = (a.sla_due_at || a.due_at) as string | null
    const bDueAt = (b.sla_due_at || b.due_at) as string | null

    if (aDueAt && bDueAt) {
      return new Date(aDueAt).getTime() - new Date(bDueAt).getTime()
    }
    if (aDueAt) return -1
    if (bDueAt) return 1

    return 0
  })
}
