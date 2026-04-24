import { RECEIPT_STATUSES, type ReceiptStatus } from '../../policies.types'
import { RECEIPT_LABELS } from '../../policiesLabels'
import { policyFieldClass } from './fieldClasses'

type ReceiptStatusSelectProps = {
  id?: string
  label?: string
  value: ReceiptStatus | ''
  onChange: (v: ReceiptStatus | '') => void
  disabled?: boolean
  allowEmpty?: boolean
}

export function ReceiptStatusSelect({
  id = 'policy_receipt',
  label,
  value,
  onChange,
  disabled,
  allowEmpty,
}: ReceiptStatusSelectProps) {
  return (
    <div>
      {label ? (
        <label htmlFor={id} className="block text-xs font-medium text-muted mb-1">
          {label}
        </label>
      ) : null}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange((e.target.value || '') as ReceiptStatus | '')}
        disabled={disabled}
        className={policyFieldClass}
      >
        {allowEmpty ? <option value="">Todos los estatus</option> : null}
        {RECEIPT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {RECEIPT_LABELS[s]}
          </option>
        ))}
      </select>
    </div>
  )
}
