import type { Lead } from '../pipeline.api'
import type { ProximaLabel } from '../utils/proximaLabel'
import { getStageTagClasses, getStageAccentStyle, displayStageName } from '../../../shared/utils/stageStyles'

type Stage = { id: string; name: string; position: number }

function phoneDigits(phone: string): string {
  return (phone || '').replace(/\D/g, '')
}

function normalizeWhatsAppNumber(digits: string): string {
  if (digits.length < 10) return ''
  if (digits.length === 10) return '52' + digits
  if (digits.startsWith('52') && digits.length >= 12 && digits.length <= 13) return digits
  return ''
}

const IconWhatsApp = () => (
  <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)
const IconPhone = () => (
  <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
  </svg>
)
const IconEmail = () => (
  <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
)
const IconChevronRight = () => (
  <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 18l6-6-6-6" />
  </svg>
)

type PipelineTableProps = {
  leads: Lead[]
  stages: Stage[]
  getProximaLabel: (stageName: string, next_follow_up_at: string | null | undefined) => ProximaLabel
  onRowClick: (lead: Lead) => void
}

function getTableStagePillClasses(stageName: string | undefined): string {
  const base = getStageTagClasses(stageName)
  return `${base} opacity-90`
}

/**
 * Vista tabla enterprise del Pipeline.
 * Estructura y estilos alineados con referencia: head bg-neutral-50, rows hover:bg-neutral-50,
 * iconos de acción visibles solo al hover de fila (opacity-0 → group-hover:opacity-100).
 */
export function PipelineTable({ leads, stages, getProximaLabel, onRowClick }: PipelineTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-neutral-200 bg-neutral-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Lead
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Contacto
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Fuente
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Próxima
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Etapa
              </th>
              <th className="w-28 min-w-28 px-4 py-3 text-right text-xs text-neutral-400">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-neutral-500">
                  No se encontraron leads con los filtros aplicados
                </td>
              </tr>
            ) : (
              leads.map((lead) => {
                const stageName = stages.find((s) => s.id === lead.stage_id)?.name
                const proxima = getProximaLabel(stageName ?? '', lead.next_follow_up_at)
                const digits = phoneDigits(lead.phone ?? '')
                const waNumber = normalizeWhatsAppNumber(digits)
                const hasPhone = !!(lead.phone?.trim())
                const hasEmail = !!(lead.email?.trim())
                const [actionPart, datePart] = proxima.line.includes(' · ')
                  ? proxima.line.split(' · ')
                  : [proxima.line, '']

                return (
                  <tr
                    key={lead.id}
                    onClick={() => onRowClick(lead)}
                    className="group cursor-pointer bg-white transition-colors hover:bg-neutral-50 focus-within:bg-neutral-50 focus-within:ring-2 focus-within:ring-neutral-200 focus-within:ring-inset"
                    style={getStageAccentStyle(stageName)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-neutral-900 text-sm">{lead.full_name}</span>
                        <span className="opacity-0 text-neutral-300 transition-opacity duration-200 group-hover:opacity-100" aria-hidden>
                          <IconChevronRight />
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        {lead.phone ? (
                          <div className="font-mono text-neutral-700 mb-0.5">{lead.phone}</div>
                        ) : null}
                        {lead.email ? (
                          <div className="truncate text-xs text-neutral-500 max-w-[180px]">
                            {lead.email}
                          </div>
                        ) : null}
                        {!lead.phone && !lead.email ? '—' : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {lead.source ? (
                        <span className="text-xs text-neutral-500">{lead.source}</span>
                      ) : (
                        <span className="text-xs text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm">
                        <div className={actionPart === 'Cerrado' ? 'font-medium text-neutral-700' : 'font-medium text-neutral-900'}>
                          {actionPart}
                        </div>
                        {datePart ? (
                          <div className="text-xs text-neutral-500">
                            {datePart}
                          </div>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={getTableStagePillClasses(stageName)}>
                        {displayStageName(stageName)}
                      </span>
                    </td>
                    <td
                      className="w-28 min-w-28 px-4 py-3 align-middle"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex min-h-[2rem] items-center justify-end gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        {waNumber ? (
                          <a
                            href={`https://wa.me/${waNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg p-1.5 text-green-600 transition-colors hover:bg-green-50"
                            title="WhatsApp"
                            aria-label="WhatsApp"
                          >
                            <IconWhatsApp />
                          </a>
                        ) : (
                          <span
                            className="cursor-not-allowed rounded-lg p-1.5 text-neutral-300"
                            title="Sin número para WhatsApp"
                            aria-hidden
                          >
                            <IconWhatsApp />
                          </span>
                        )}
                        {hasPhone ? (
                          <a
                            href={`tel:${(lead.phone || '').replace(/\s/g, '')}`}
                            className="rounded-lg p-1.5 text-blue-600 transition-colors hover:bg-blue-50"
                            title="Llamar"
                            aria-label="Llamar"
                          >
                            <IconPhone />
                          </a>
                        ) : (
                          <span
                            className="cursor-not-allowed rounded-lg p-1.5 text-neutral-300"
                            title="Sin teléfono"
                            aria-hidden
                          >
                            <IconPhone />
                          </span>
                        )}
                        {hasEmail ? (
                          <a
                            href={`mailto:${lead.email}`}
                            className="rounded-lg p-1.5 text-neutral-600 transition-colors hover:bg-neutral-100"
                            title="Email"
                            aria-label="Email"
                          >
                            <IconEmail />
                          </a>
                        ) : (
                          <span
                            className="cursor-not-allowed rounded-lg p-1.5 text-neutral-300"
                            title="Sin email"
                            aria-hidden
                          >
                            <IconEmail />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
