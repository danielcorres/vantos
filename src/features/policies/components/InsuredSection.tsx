import { useState } from 'react'
import { policyInsuredApi } from '../policyInsured.api'
import type { PolicyInsured } from '../policies.insured.types'
import { usePolicyInsured } from '../hooks/usePolicyInsured'
import { RELATIONSHIP_LABELS } from '../policiesLabels'
import { InsuredForm } from './InsuredForm'
import { useNotify } from '../../../shared/utils/notify'
import { LoadingSpinner } from '../../../components/ui/LoadingSpinner'

type InsuredSectionProps = {
  policyId: string
}

export function InsuredSection({ policyId }: InsuredSectionProps) {
  const notify = useNotify()
  const { insured, loading, error, reload } = usePolicyInsured(policyId)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PolicyInsured | null>(null)

  const openCreate = () => {
    setEditing(null)
    setShowForm(true)
  }

  const openEdit = (row: PolicyInsured) => {
    setEditing(row)
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditing(null)
  }

  const handleSaved = () => {
    reload()
    closeForm()
  }

  const handleDelete = (row: PolicyInsured) => {
    if (
      !window.confirm(
        `¿Eliminar a ${row.full_name} de esta póliza? Esta acción no se puede deshacer.`
      )
    ) {
      return
    }
    void (async () => {
      try {
        await policyInsuredApi.remove(row.id)
        reload()
        notify.success('insured.deleted')
      } catch (e) {
        notify.raw(
          e instanceof Error && e.message
            ? e.message
            : 'No se pudo eliminar el asegurado. Inténtalo nuevamente',
          'error'
        )
      }
    })()
  }

  return (
    <div className="border-t border-border bg-bg/40 px-3 py-4 dark:border-neutral-800 dark:bg-neutral-950/30">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-text">Asegurados</h3>
          <p className="text-xs text-muted">
            {insured.length} {insured.length === 1 ? 'persona asegurada' : 'personas aseguradas'}
          </p>
        </div>
        {!showForm ? (
          <button type="button" className="btn btn-ghost text-xs font-medium" onClick={openCreate}>
            + Agregar
          </button>
        ) : null}
      </div>

      {error ? <div className="mb-2 text-xs text-red-700 dark:text-red-300">{error}</div> : null}
      {loading ? (
        <LoadingSpinner size={14} label="Cargando asegurados..." className="text-xs text-muted mb-2" />
      ) : null}

      {showForm ? (
        <InsuredForm policyId={policyId} editing={editing} onCancel={closeForm} onSaved={handleSaved} />
      ) : insured.length === 0 ? (
        <p className="text-xs text-muted">No hay asegurados. Usa &quot;+ Agregar&quot; para registrar titular o dependientes.</p>
      ) : (
        <ul className="space-y-2">
          {insured.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900/50"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-text">{row.full_name}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="rounded-full border border-border px-1.5 py-0.5 dark:border-neutral-600">
                    {RELATIONSHIP_LABELS[row.relationship]}
                  </span>
                  {row.birth_date ? <span>{row.birth_date}</span> : null}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" className="btn btn-ghost text-xs" onClick={() => openEdit(row)}>
                  Editar
                </button>
                <button
                  type="button"
                  className="btn btn-ghost text-xs text-red-700 dark:text-red-400"
                  onClick={() => handleDelete(row)}
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
