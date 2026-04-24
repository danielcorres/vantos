import { FORM_RAMOS, isFormRamo } from '../policies.constants'
import type { Ramo } from '../policies.types'
import { RAMO_LABELS } from '../policiesLabels'

type RamoPillGroupProps = {
  id?: string
  label: string
  value: Ramo
  onChange: (v: Ramo) => void
  disabled?: boolean
}

const pillBase =
  'rounded-full px-3 py-1.5 text-sm font-medium border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-primary dark:focus-visible:ring-offset-neutral-950'

const pillInactive =
  'border-border bg-surface text-text hover:bg-bg dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800'

const pillActive =
  'border-primary bg-primary text-white dark:border-primary dark:bg-primary dark:text-white'

export function RamoPillGroup({
  id = 'policy_ramo',
  label,
  value,
  onChange,
  disabled,
}: RamoPillGroupProps) {
  const labelId = `${id}_label`

  return (
    <div>
      <div id={labelId} className="block text-xs font-medium text-muted mb-1.5">
        {label} <span className="text-text dark:text-neutral-200">*</span>
      </div>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex flex-wrap gap-2"
      >
        {FORM_RAMOS.map((r) => {
          const selected = value === r
          return (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(r)}
              className={`${pillBase} ${selected ? pillActive : pillInactive} ${
                disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {RAMO_LABELS[r]}
            </button>
          )
        })}
      </div>
      {!isFormRamo(value) ? (
        <p className="text-xs text-muted mt-1.5">
          Ramo actual no disponible en captura (legado). Elige Vida o GMM para actualizar.
        </p>
      ) : null}
    </div>
  )
}
