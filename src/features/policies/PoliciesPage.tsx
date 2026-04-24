import { useCallback, useState } from 'react'
import { policiesApi } from './policies.api'
import { DEFAULT_INSURER } from './policies.constants'
import type { Policy } from './policies.types'
import { usePolicies } from './hooks/usePolicies'
import { PolicyFilters } from './components/PolicyFilters'
import { PolicyList } from './components/PolicyList'
import { PolicyForm } from './components/PolicyForm'

export function PoliciesPage() {
  const { policies, loading, error, filters, setFilters, reload } = usePolicies()
  const [formOpen, setFormOpen] = useState(false)
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null)

  const openCreate = useCallback(() => {
    setEditingPolicy(null)
    setFormOpen(true)
  }, [])

  const openEdit = useCallback((p: Policy) => {
    setEditingPolicy(p)
    setFormOpen(true)
  }, [])

  const closeForm = useCallback(() => {
    setFormOpen(false)
    setEditingPolicy(null)
  }, [])

  const handleSaved = useCallback(() => {
    reload()
    closeForm()
  }, [reload, closeForm])

  const handleDelete = useCallback(
    async (id: string) => {
      await policiesApi.remove(id)
      reload()
    },
    [reload]
  )

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text">Pólizas</h1>
          <p className="text-sm text-muted mt-0.5">
            Registro de pólizas Vida y GMM ({DEFAULT_INSURER}). Solo ves las pólizas de tu cuenta.
          </p>
        </div>
        <button type="button" className="btn btn-primary text-sm font-medium shrink-0" onClick={openCreate}>
          Nueva póliza
        </button>
      </div>

      <PolicyFilters filters={filters} onChange={setFilters} />

      {error ? (
        <div className="p-3 rounded border border-red-200 bg-red-50 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : null}

      <PolicyList policies={policies} loading={loading} onEdit={openEdit} onDelete={handleDelete} />

      <PolicyForm
        isOpen={formOpen}
        onClose={closeForm}
        editingPolicy={editingPolicy}
        onSaved={handleSaved}
      />
    </div>
  )
}
