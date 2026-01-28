import type { Lead } from '../pipeline.api'
import type { ProximaLabel } from '../utils/proximaLabel'
import { getStageTagClasses, getStageAccentStyle, displayStageName } from '../../../shared/utils/stageStyles'

type Stage = { id: string; name: string; position: number }

function phoneDigits(phone: string): string {
  return (phone || '').replace(/\D/g, '')
}

/** Número para wa.me en MX: 10 dígitos -> "52"+digits; ya con 52 y 12–13 dígitos -> as-is; <10 -> "" */
function normalizeWhatsAppNumber(digits: string): string {
  if (digits.length < 10) return ''
  if (digits.length === 10) return '52' + digits
  if (digits.startsWith('52') && digits.length >= 12 && digits.length <= 13) return digits
  return ''
}

type LeadsTableProps = {
  leads: Lead[]
  stages: Stage[]
  getProximaLabel: (stageName: string, next_follow_up_at: string | null | undefined) => ProximaLabel
  onRowClick: (lead: Lead) => void
}

export function LeadsTable({ leads, stages, getProximaLabel, onRowClick }: LeadsTableProps) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted">
            <th className="py-2 pr-4 font-medium">Lead</th>
            <th className="py-2 pr-4 font-medium">Contacto</th>
            <th className="py-2 pr-4 font-medium">Fuente</th>
            <th className="py-2 pr-4 font-medium">Próxima</th>
            <th className="py-2 pr-4 font-medium">Etapa</th>
            <th className="py-2 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {leads.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-8 text-center text-muted">
                No hay leads en esta vista.
              </td>
            </tr>
          ) : (
            leads.map((lead) => {
              const stageName = stages.find((s) => s.id === lead.stage_id)?.name
              const proxima = getProximaLabel(stageName ?? '', lead.next_follow_up_at)
              const digits = phoneDigits(lead.phone ?? '')
              const waNumber = normalizeWhatsAppNumber(digits)

              return (
                <tr
                  key={lead.id}
                  onClick={() => onRowClick(lead)}
                  className="cursor-pointer border-b border-border/60 hover:bg-muted/40 transition-colors duration-150"
                  style={getStageAccentStyle(stageName)}
                >
                  <td className="py-2.5 pr-4 font-medium">{lead.full_name}</td>
                  <td className="py-2.5 pr-4 text-muted">
                    <div className="leading-tight">
                      {lead.phone ? (
                        <span className="block">{lead.phone}</span>
                      ) : null}
                      {lead.email ? (
                        <span className={`block ${lead.phone ? 'mt-0.5' : ''}`}>{lead.email}</span>
                      ) : null}
                      {!lead.phone && !lead.email ? '—' : null}
                    </div>
                  </td>
                  <td className="py-2.5 pr-4">
                    {lead.source ? (
                      <span className="inline-block rounded-full px-2 py-0.5 text-xs ring-1 ring-neutral-200 bg-neutral-50 text-neutral-700">
                        {lead.source}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={proxima.isMuted ? 'text-muted' : proxima.colorClass}>
                      {proxima.line}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className={getStageTagClasses(stageName)}>
                      {displayStageName(stageName)}
                    </span>
                  </td>
                  <td className="py-2.5" onClick={(e) => e.stopPropagation()}>
                    <span className="inline-flex items-center gap-1">
                      {waNumber ? (
                        <a
                          href={`https://wa.me/${waNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-ghost px-2 py-0.5 text-xs rounded-md border border-border/60 hover:bg-black/5"
                        >
                          WhatsApp
                        </a>
                      ) : null}
                      {lead.phone ? (
                        <a
                          href={`tel:${(lead.phone || '').replace(/\s/g, '')}`}
                          className="btn btn-ghost px-2 py-0.5 text-xs rounded-md border border-border/60 hover:bg-black/5"
                        >
                          Llamar
                        </a>
                      ) : null}
                      {lead.email ? (
                        <a
                          href={`mailto:${lead.email}`}
                          className="btn btn-ghost px-2 py-0.5 text-xs rounded-md border border-border/60 hover:bg-black/5"
                        >
                          Email
                        </a>
                      ) : null}
                      {!waNumber && !lead.phone && !lead.email ? (
                        <span className="text-muted text-xs">—</span>
                      ) : null}
                    </span>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
