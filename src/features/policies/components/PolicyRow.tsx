import type { Policy } from '../policies.types'
import { CURRENCY_LABELS, RAMO_LABELS, RECEIPT_LABELS } from '../policiesLabels'

type PolicyRowProps = {
  policy: Policy
  onEdit: (p: Policy) => void
  onDelete: (id: string) => Promise<void>
}

function formatPremium(amount: number, currency: Policy['currency']): string {
  const n = amount.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${n} ${CURRENCY_LABELS[currency]}`
}

export function PolicyRow({ policy, onEdit, onDelete }: PolicyRowProps) {
  const handleDelete = () => {
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
      } catch (e) {
        window.alert(e instanceof Error ? e.message : 'No se pudo eliminar')
      }
    })()
  }

  return (
    <tr className="border-b border-border/60 dark:border-neutral-800 hover:bg-bg/80 dark:hover:bg-neutral-900/50">
      <td className="py-2.5 px-2 text-sm">{policy.contractor_name}</td>
      <td className="py-2.5 px-2 text-sm">{policy.insurer}</td>
      <td className="py-2.5 px-2 text-sm font-mono text-xs">{policy.policy_number}</td>
      <td className="py-2.5 px-2 text-sm">{RAMO_LABELS[policy.ramo]}</td>
      <td className="py-2.5 px-2 text-sm whitespace-nowrap">
        {policy.start_date} → {policy.end_date}
      </td>
      <td className="py-2.5 px-2 text-sm text-right whitespace-nowrap">{formatPremium(policy.premium_amount, policy.currency)}</td>
      <td className="py-2.5 px-2 text-sm">{RECEIPT_LABELS[policy.receipt_status]}</td>
      <td className="py-2.5 px-2 text-sm text-right whitespace-nowrap">
        <button type="button" className="btn btn-ghost text-xs mr-1" onClick={() => onEdit(policy)}>
          Editar
        </button>
        <button type="button" className="btn btn-ghost text-xs text-red-700 dark:text-red-400" onClick={handleDelete}>
          Eliminar
        </button>
      </td>
    </tr>
  )
}
