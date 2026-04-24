import { Fragment, useEffect, useState } from 'react'
import type { Policy } from '../policies.types'
import { PolicyRow } from './PolicyRow'
import { InsuredSection } from './InsuredSection'

type PolicyListProps = {
  policies: Policy[]
  loading: boolean
  onEdit: (p: Policy) => void
  onDelete: (id: string) => Promise<void>
}

export function PolicyList({ policies, loading, onEdit, onDelete }: PolicyListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    if (expandedId && !policies.some((p) => p.id === expandedId)) {
      setExpandedId(null)
    }
  }, [policies, expandedId])

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
      <p className="px-3 py-2 text-xs text-muted border-b border-border dark:border-neutral-800">
        Pulsa una fila para ver o gestionar <strong className="text-text dark:text-neutral-200">asegurados</strong>.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface/80 dark:bg-neutral-900/80 dark:border-neutral-800">
              <th className="py-2 px-2 text-xs font-semibold text-muted uppercase tracking-wide">Contratante</th>
              <th className="py-2 px-2 text-xs font-semibold text-muted uppercase tracking-wide">Aseguradora</th>
              <th className="py-2 px-2 text-xs font-semibold text-muted uppercase tracking-wide">N° Póliza</th>
              <th className="py-2 px-2 text-xs font-semibold text-muted uppercase tracking-wide">Ramo</th>
              <th className="py-2 px-2 text-xs font-semibold text-muted uppercase tracking-wide">Vigencia</th>
              <th className="py-2 px-2 text-xs font-semibold text-muted uppercase tracking-wide">Estado</th>
              <th className="py-2 px-2 text-xs font-semibold text-muted uppercase tracking-wide text-right">Prima</th>
              <th className="py-2 px-2 text-xs font-semibold text-muted uppercase tracking-wide">Recibo</th>
              <th className="py-2 px-2 text-xs font-semibold text-muted uppercase tracking-wide text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((p) => (
              <Fragment key={p.id}>
                <PolicyRow
                  policy={p}
                  expanded={expandedId === p.id}
                  onToggleExpand={() => setExpandedId((cur) => (cur === p.id ? null : p.id))}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
                {expandedId === p.id ? (
                  <tr className="border-b border-border/60 bg-bg/50 dark:border-neutral-800 dark:bg-neutral-950/40">
                    <td colSpan={9} className="p-0 align-top">
                      <InsuredSection policyId={p.id} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
