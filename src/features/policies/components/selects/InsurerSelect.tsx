import { policyFieldClass } from './fieldClasses'

/** Aseguradora libre + sugerencias opcionales (datalist). */
const INSURER_SUGGESTIONS = [
  'GNP',
  'MetLife',
  'AXA',
  'Qualitas',
  'HDI',
  'Zurich',
  'Chubb',
  'Mapfre',
  'Banorte',
  'Afirme',
]

type InsurerSelectProps = {
  id?: string
  label?: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  placeholder?: string
}

export function InsurerSelect({
  id = 'policy_insurer',
  label,
  value,
  onChange,
  disabled,
  placeholder = 'Ej. GNP Seguros',
}: InsurerSelectProps) {
  const listId = `${id}_list`
  return (
    <div>
      {label ? (
        <label htmlFor={id} className="block text-xs font-medium text-muted mb-1">
          {label}
        </label>
      ) : null}
      <input
        id={id}
        type="text"
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={policyFieldClass}
        autoComplete="off"
      />
      <datalist id={listId}>
        {INSURER_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  )
}
