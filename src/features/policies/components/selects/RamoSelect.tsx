import { useMemo } from 'react'
import { FORM_RAMOS } from '../../policies.constants'
import type { Ramo } from '../../policies.types'
import { RAMO_LABELS } from '../../policiesLabels'
import { policyFieldClass } from './fieldClasses'

type RamoSelectProps = {
  id?: string
  label?: string
  value: Ramo | ''
  onChange: (v: Ramo | '') => void
  disabled?: boolean
  /** Si true, primera opción es "Todos" (valor ''). */
  allowEmpty?: boolean
}

function buildOptions(value: Ramo | ''): Ramo[] {
  const base = [...FORM_RAMOS]
  if (value && !(FORM_RAMOS as readonly string[]).includes(value)) {
    return [value as Ramo, ...base]
  }
  return base
}

export function RamoSelect({
  id = 'policy_ramo',
  label,
  value,
  onChange,
  disabled,
  allowEmpty,
}: RamoSelectProps) {
  const options = useMemo(() => buildOptions(value), [value])

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
        onChange={(e) => onChange((e.target.value || '') as Ramo | '')}
        disabled={disabled}
        className={policyFieldClass}
      >
        {allowEmpty ? <option value="">Todos los ramos</option> : null}
        {options.map((r) => {
          const legacy = !(FORM_RAMOS as readonly string[]).includes(r)
          return (
            <option key={r} value={r}>
              {RAMO_LABELS[r]}
              {legacy ? ' (legado)' : ''}
            </option>
          )
        })}
      </select>
    </div>
  )
}
