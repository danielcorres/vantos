import { useInsuredForm } from '../hooks/useInsuredForm'
import type { PolicyInsured, Relationship } from '../policies.insured.types'
import { RELATIONSHIPS } from '../policies.insured.types'
import { RELATIONSHIP_LABELS } from '../policiesLabels'
import { policyFieldClass } from './selects/fieldClasses'

type InsuredFormProps = {
  policyId: string
  editing: PolicyInsured | null
  onCancel: () => void
  onSaved: () => void
}

export function InsuredForm({ policyId, editing, onCancel, onSaved }: InsuredFormProps) {
  const { values, setField, submitting, error, submit, reset } = useInsuredForm({
    policyId,
    editing,
    onSaved,
  })

  const handleCancel = () => {
    reset()
    onCancel()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await submit()
  }

  const title = editing ? 'Editar asegurado' : 'Nuevo asegurado'

  return (
    <div className="rounded-lg border border-border bg-surface p-4 dark:border-neutral-700 dark:bg-neutral-900/40">
      <h4 className="text-sm font-semibold text-text dark:text-neutral-100 mb-3">{title}</h4>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label htmlFor="insured_full_name" className="block text-xs font-medium text-muted mb-1">
            Nombre completo *
          </label>
          <input
            id="insured_full_name"
            type="text"
            value={values.full_name}
            onChange={(e) => setField('full_name', e.target.value)}
            disabled={submitting}
            className={policyFieldClass}
          />
        </div>
        <div>
          <label htmlFor="insured_relationship" className="block text-xs font-medium text-muted mb-1">
            Parentesco
          </label>
          <select
            id="insured_relationship"
            value={values.relationship}
            onChange={(e) => setField('relationship', e.target.value as Relationship)}
            disabled={submitting}
            className={policyFieldClass}
          >
            {RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>
                {RELATIONSHIP_LABELS[r]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="insured_birth" className="block text-xs font-medium text-muted mb-1">
            Fecha de nacimiento
          </label>
          <input
            id="insured_birth"
            type="date"
            value={values.birth_date ?? ''}
            onChange={(e) => setField('birth_date', e.target.value ? e.target.value : null)}
            disabled={submitting}
            className={policyFieldClass}
          />
        </div>
        <div>
          <label htmlFor="insured_phone" className="block text-xs font-medium text-muted mb-1">
            Teléfono
          </label>
          <input
            id="insured_phone"
            type="tel"
            value={values.phone ?? ''}
            onChange={(e) => setField('phone', e.target.value.trim() || null)}
            disabled={submitting}
            className={policyFieldClass}
            placeholder="10 dígitos"
          />
        </div>
        <div>
          <label htmlFor="insured_email" className="block text-xs font-medium text-muted mb-1">
            Email
          </label>
          <input
            id="insured_email"
            type="email"
            value={values.email ?? ''}
            onChange={(e) => setField('email', e.target.value.trim() || null)}
            disabled={submitting}
            className={policyFieldClass}
            placeholder="correo@ejemplo.com"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="insured_notes" className="block text-xs font-medium text-muted mb-1">
            Notas
          </label>
          <textarea
            id="insured_notes"
            rows={2}
            value={values.notes ?? ''}
            onChange={(e) => setField('notes', e.target.value.trim() || null)}
            disabled={submitting}
            className={policyFieldClass}
            placeholder="Observaciones opcionales…"
          />
        </div>

        {error ? (
          <div className="sm:col-span-2 text-xs text-red-700 dark:text-red-300">{error}</div>
        ) : null}

        <div className="sm:col-span-2 flex flex-wrap gap-2 justify-end pt-1">
          <button type="button" className="btn btn-ghost text-xs" onClick={handleCancel} disabled={submitting}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary text-sm" disabled={submitting}>
            {submitting ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </div>
  )
}
