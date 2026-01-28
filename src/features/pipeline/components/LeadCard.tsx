import type { Lead } from '../pipeline.api'
import { getSlaPill } from '../utils/slaHelpers'

interface LeadCardProps {
  lead: Lead
  onDragStart: (e: React.DragEvent, lead: Lead) => void
}

function formatNextFollowUp(dateString: string | null | undefined): string | null {
  if (!dateString) return null
  try {
    const d = new Date(dateString)
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    const day = d.getDate()
    const month = months[d.getMonth()]
    return `${day} ${month}`
  } catch {
    return null
  }
}

export function LeadCard({ lead, onDragStart }: LeadCardProps) {
  const slaPill = getSlaPill(lead)
  const nextLabel = formatNextFollowUp(lead.next_follow_up_at)

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      className="group rounded-xl border border-neutral-200 bg-white p-3 shadow-sm transition-colors cursor-grab hover:border-neutral-300 hover:shadow-md active:cursor-grabbing"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1 font-semibold text-neutral-900 text-sm leading-tight">
          {lead.full_name}
        </div>
        {slaPill && (
          <span
            className={slaPill.className}
            style={slaPill.style}
            title={slaPill.label}
          >
            {slaPill.label}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-1 text-xs text-neutral-400 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>
          <span>Ver detalle</span>
          <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
        {lead.phone && <span>📞 {lead.phone}</span>}
        {lead.source && <span>{lead.phone ? '·' : ''} {lead.source}</span>}
      </div>
      {nextLabel && (
        <div className="mt-1.5 text-xs text-neutral-500">
          Próximo: {nextLabel}
        </div>
      )}
    </div>
  )
}
