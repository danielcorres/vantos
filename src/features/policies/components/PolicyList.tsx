import type { Policy } from '../policies.types'
import { PolicyRow } from './PolicyRow'

type PolicyListProps = {
  policies: Policy[]
  loading: boolean
  onEdit: (p: Policy) => void
  onDelete: (id: string) => Promise<void>
}

export function PolicyList({ policies, loading, onEdit, onDelete }: PolicyListProps) {
  if (loading) {
    return (
      <div className="card p-8 text-center text-muted text-sm">Cargando pólizas…</div>
    )
  }

  if (policies.length === 0) {
    return (
      <div className="card p-8 text-center text-muted text-sm">
        No hay pólizas que coincidan con los filtros. Crea una nueva con el botón superior.
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface/80 dark:bg-neutral-900/80 dark:border-neutral-800">
              <th className="py-2 px-2 text-xs font-semibold text-muted uppercase tracking-wide">Contratante</th>
              <th className="py-2 px-2 text-xs font-semibold text-muted uppercase tracking-wide">Aseguradora</th>
              <th className="py-2 px-2 text-xs font-semibold text-muted uppercase tracking-wide">N° Póliza</th>
              <th className="py-2 px-2 text-xs font-semibold text-muted uppercase tracking-wide">Ramo</th>
              <th className="py-2 px-2 text-xs font-semibold text-muted uppercase tracking-wide">Vigencia</th>
              <th className="py-2 px-2 text-xs font-semibold text-muted uppercase tracking-wide text-right">Prima</th>
              <th className="py-2 px-2 text-xs font-semibold text-muted uppercase tracking-wide">Recibo</th>
              <th className="py-2 px-2 text-xs font-semibold text-muted uppercase tracking-wide text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((p) => (
              <PolicyRow key={p.id} policy={p} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
