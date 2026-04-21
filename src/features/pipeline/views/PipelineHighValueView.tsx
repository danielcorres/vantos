import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Lead, PipelineStage } from '../pipeline.api'
import { formatCurrencyMXN } from '../../../shared/utils/format'
import { displayStageName, getStageAccentStyle } from '../../../shared/utils/stageStyles'
function sortByEstimatedValueDesc(leads: Lead[]): Lead[] {
  return [...leads].sort((a, b) => {
    const aVal = a.estimated_value ?? 0
    const bVal = b.estimated_value ?? 0
    return bVal - aVal
  })
}

export function PipelineHighValueView({
  leads,
  stages,
}: {
  leads: Lead[]
  stages: PipelineStage[]
}) {
  const navigate = useNavigate()

  const filteredAndSorted = useMemo(() => {
    const withValue = leads.filter((l) => l.estimated_value != null && l.estimated_value > 0)
    return sortByEstimatedValueDesc(withValue)
  }, [leads])

  if (filteredAndSorted.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 dark:bg-neutral-800/40 p-8 text-center">
        <p className="text-sm text-neutral-700 dark:text-neutral-300 mb-2">
          No hay leads con valor estimado. Agrega un valor estimado en el detalle de cada lead.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500">Nombre</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 hidden lg:table-cell">Etapa</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-neutral-500">Valor estimado</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-neutral-500 hidden xl:table-cell">
                Cierre esperado
              </th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-neutral-500">Acción</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map((lead) => {
              const stage = stages.find((s) => s.id === lead.stage_id)
              const stageSlug = stage?.slug
              return (
                <tr
                  key={lead.id}
                  onClick={() => navigate(`/leads/${lead.id}`)}
                  className="cursor-pointer hover:bg-neutral-50 transition-colors border-b border-neutral-100 last:border-b-0"
                  style={getStageAccentStyle(stageSlug)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/leads/${lead.id}`)
                    }
                  }}
                >
                  <td className="px-4 py-2.5 font-medium text-neutral-900">{lead.full_name}</td>
                  <td className="px-4 py-2.5 text-neutral-600 hidden lg:table-cell">
                    {displayStageName(stage?.name) ?? '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                    {formatCurrencyMXN(lead.estimated_value)}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600 hidden xl:table-cell tabular-nums">
                    {lead.expected_close_at
                      ? new Date(lead.expected_close_at).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/leads/${lead.id}`)
                      }}
                      className="text-sm text-primary hover:underline"
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          {filteredAndSorted.length} lead{filteredAndSorted.length === 1 ? '' : 's'} con valor estimado
        </span>
        <span className="tabular-nums font-medium">
          Total:{' '}
          {formatCurrencyMXN(
            filteredAndSorted.reduce((sum, l) => sum + (l.estimated_value ?? 0), 0)
          )}
        </span>
      </div>
    </div>
  )
}
