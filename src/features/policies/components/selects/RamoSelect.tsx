import { RAMOS, type Ramo } from '../../policies.types'
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

export function RamoSelect({
  id = 'policy_ramo',
  label,
  value,
  onChange,
  disabled,
  allowEmpty,
}: RamoSelectProps) {
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
        {RAMOS.map((r) => (
          <option key={r} value={r}>
            {RAMO_LABELS[r]}
          </option>
        ))}
      </select>
    </div>
  )
}
