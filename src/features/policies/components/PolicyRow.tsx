import type { MouseEvent } from 'react'
import type { Policy } from '../policies.types'
import { CURRENCY_LABELS, RAMO_LABELS, RECEIPT_LABELS } from '../policiesLabels'
import { PolicyStatusBadge } from './PolicyStatusBadge'

type PolicyRowProps = {
  policy: Policy
  expanded?: boolean
  onToggleExpand?: () => void
  onEdit: (p: Policy) => void
  onDelete: (id: string) => Promise<void>
}

function formatPremium(amount: number, currency: Policy['currency']): string {
  const n = amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${n} ${CURRENCY_LABELS[currency]}`
}

export function PolicyRow({
  policy,
  expanded = false,
  onToggleExpand,
  onEdit,
  onDelete,
}: PolicyRowProps) {
  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation()
    if (
      !window.confirm(
        `¿Eliminar la póliza ${policy.policy_number} de ${policy.contractor_name}? Esta acción no se puede deshacer.`
      )
    ) {
      return
    }
    void (async () => {
      try {
        await onDelete(policy.id)
      } catch (err) {
        window.alert(err instanceof Error ? err.message : 'No se pudo eliminar')
      }
    })()
  }

  const handleEdit = (e: MouseEvent) => {
    e.stopPropagation()
    onEdit(policy)
  }

  const handleRowClick = (e: MouseEvent<HTMLTableRowElement>) => {
    if ((e.target as HTMLElement).closest('button')) return
    onToggleExpand?.()
  }

  return (
    <tr
      onClick={handleRowClick}
      className={`border-b border-border/60 dark:border-neutral-800 cursor-pointer transition-colors ${
        expanded
          ? 'bg-surface/90 dark:bg-neutral-900/70'
          : 'hover:bg-bg/80 dark:hover:bg-neutral-900/50'
      }`}
    >
      <td className="py-2.5 px-2 text-sm">{policy.contractor_name}</td>
      <td className="py-2.5 px-2 text-sm">{policy.insurer}</td>
      <td className="py-2.5 px-2 text-sm font-mono text-xs">{policy.policy_number}</td>
      <td className="py-2.5 px-2 text-sm">{RAMO_LABELS[policy.ramo]}</td>
      <td className="py-2.5 px-2 text-sm whitespace-nowrap">
        {policy.start_date} → {policy.end_date}
      </td>
      <td className="py-2.5 px-2 text-sm">
        <PolicyStatusBadge endDateYmd={policy.end_date} />
      </td>
      <td className="py-2.5 px-2 text-sm text-right whitespace-nowrap">{formatPremium(policy.premium_amount, policy.currency)}</td>
      <td className="py-2.5 px-2 text-sm">{RECEIPT_LABELS[policy.receipt_status]}</td>
      <td className="py-2.5 px-2 text-sm text-right whitespace-nowrap">
        <button type="button" className="btn btn-ghost text-xs mr-1" onClick={handleEdit}>
          Editar
        </button>
        <button
          type="button"
          className="btn btn-ghost text-xs text-red-700 dark:text-red-400"
          onClick={handleDelete}
        >
          Eliminar
        </button>
      </td>
    </tr>
  )
}
