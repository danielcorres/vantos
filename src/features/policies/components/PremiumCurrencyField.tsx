import { CURRENCIES, type Currency } from '../policies.types'
import { CURRENCY_LABELS } from '../policiesLabels'

type PremiumCurrencyFieldProps = {
  id?: string
  label: string
  help?: string
  amount: number
  currency: Currency
  onAmountChange: (n: number) => void
  onCurrencyChange: (c: Currency) => void
  disabled?: boolean
}

const pillBase =
  'px-2 py-1 text-xs font-semibold rounded-md border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 dark:focus-visible:ring-offset-neutral-950'

const pillOff =
  'border-transparent text-muted hover:bg-bg dark:hover:bg-neutral-800'

const pillOn =
  'border-primary bg-primary text-white dark:bg-primary dark:text-white dark:border-primary'

export function PremiumCurrencyField({
  id = 'premium_amount',
  label,
  help,
  amount,
  currency,
  onAmountChange,
  onCurrencyChange,
  disabled,
}: PremiumCurrencyFieldProps) {
  const labelId = `${id}_label`

  return (
    <div>
      <div className="flex items-center gap-1 mb-1.5">
        <label id={labelId} htmlFor={id} className="text-xs font-medium text-muted">
          {label} <span className="text-text dark:text-neutral-200">*</span>
        </label>
        {help ? (
          <button
            type="button"
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-semibold text-muted hover:bg-bg dark:border-neutral-600 dark:hover:bg-neutral-800"
            title={help}
            aria-label={help}
          >
            ?
          </button>
        ) : null}
      </div>

      <div
        className="flex min-h-[2.375rem] overflow-hidden rounded-md border border-border bg-bg dark:bg-neutral-950 dark:border-neutral-700"
        role="group"
        aria-labelledby={labelId}
      >
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          value={amount || ''}
          onChange={(e) => onAmountChange(Number(e.target.value))}
          disabled={disabled}
          className="min-w-0 flex-1 border-0 bg-transparent px-2.5 py-1.5 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-0 dark:text-neutral-100"
          placeholder="0.00"
        />
        <div
          className="flex shrink-0 items-center gap-0.5 border-l border-border px-1 py-1 dark:border-neutral-700"
          role="radiogroup"
          aria-label="Moneda"
        >
          {CURRENCIES.map((c) => {
            const on = currency === c
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={disabled}
                onClick={() => onCurrencyChange(c)}
                className={`${pillBase} ${on ? pillOn : pillOff} ${
                  disabled ? 'cursor-not-allowed opacity-50' : ''
                }`}
              >
                {CURRENCY_LABELS[c]}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
