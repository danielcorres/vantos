import { CURRENCIES, type Currency } from '../../policies.types'
import { CURRENCY_LABELS } from '../../policiesLabels'
import { policyFieldClass } from './fieldClasses'

type CurrencySelectProps = {
  id?: string
  label?: string
  value: Currency
  onChange: (v: Currency) => void
  disabled?: boolean
}

export function CurrencySelect({
  id = 'policy_currency',
  label,
  value,
  onChange,
  disabled,
}: CurrencySelectProps) {
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
        onChange={(e) => onChange(e.target.value as Currency)}
        disabled={disabled}
        className={policyFieldClass}
      >
        {CURRENCIES.map((c) => (
          <option key={c} value={c}>
            {CURRENCY_LABELS[c]}
          </option>
        ))}
      </select>
    </div>
  )
}
