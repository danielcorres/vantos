import { PAYMENT_FREQUENCIES, type PaymentFrequency } from '../../policies.types'
import { FREQUENCY_LABELS } from '../../policiesLabels'
import { policyFieldClass } from './fieldClasses'

type FrequencySelectProps = {
  id?: string
  label?: string
  value: PaymentFrequency
  onChange: (v: PaymentFrequency) => void
  disabled?: boolean
}

export function FrequencySelect({
  id = 'policy_frequency',
  label,
  value,
  onChange,
  disabled,
}: FrequencySelectProps) {
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
        onChange={(e) => onChange(e.target.value as PaymentFrequency)}
        disabled={disabled}
        className={policyFieldClass}
      >
        {([...PAYMENT_FREQUENCIES] as PaymentFrequency[]).map((f) => (
          <option key={f} value={f}>
            {FREQUENCY_LABELS[f]}
          </option>
        ))}
      </select>
    </div>
  )
}
