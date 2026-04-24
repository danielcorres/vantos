import type { PaymentFrequency } from '../policies.types'
import { PAYMENT_FREQUENCIES } from '../policies.types'
import { FREQUENCY_LABELS } from '../policiesLabels'

const DISPLAY_ORDER: readonly PaymentFrequency[] = [
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
]

type FrequencyPillGroupProps = {
  id?: string
  label: string
  value: PaymentFrequency
  onChange: (v: PaymentFrequency) => void
  disabled?: boolean
}

const pillBase =
  'rounded-full px-2.5 py-1 text-xs font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary dark:focus-visible:ring-offset-neutral-950 sm:px-3 sm:text-sm'

const pillInactive =
  'border-border bg-surface text-text hover:bg-bg dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800'

const pillActive =
  'border-primary bg-primary text-white dark:border-primary dark:bg-primary dark:text-white'

export function FrequencyPillGroup({
  id = 'policy_frequency',
  label,
  value,
  onChange,
  disabled,
}: FrequencyPillGroupProps) {
  const labelId = `${id}_label`
  const ordered = DISPLAY_ORDER.filter((f) => (PAYMENT_FREQUENCIES as readonly string[]).includes(f))

  return (
    <div>
      <div id={labelId} className="block text-xs font-medium text-muted mb-1.5">
        {label} <span className="text-text dark:text-neutral-200">*</span>
      </div>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-1.5 sm:gap-2">
        {ordered.map((f) => {
          const selected = value === f
          return (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(f)}
              className={`${pillBase} ${selected ? pillActive : pillInactive} ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {FREQUENCY_LABELS[f]}
            </button>
          )
        })}
      </div>
    </div>
  )
}
