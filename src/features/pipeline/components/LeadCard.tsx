import type { Lead } from '../pipeline.api'
import { getSlaPill } from '../utils/slaHelpers'

interface LeadCardProps {
  lead: Lead
  onDragStart: (e: React.DragEvent, lead: Lead) => void
}

export function LeadCard({ lead, onDragStart }: LeadCardProps) {
  const slaPill = getSlaPill(lead)

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      className="card"
      style={{
        marginBottom: '8px',
        cursor: 'grab',
        padding: '12px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '8px',
          marginBottom: '4px',
        }}
      >
        <div style={{ fontWeight: '600', flex: 1 }}>{lead.full_name}</div>
        {slaPill && (
          <span className={slaPill.className} style={slaPill.style} title={slaPill.label}>
            {slaPill.label}
          </span>
        )}
      </div>
      {lead.phone && (
        <div className="muted" style={{ fontSize: '12px', marginBottom: '2px' }}>
          📞 {lead.phone}
        </div>
      )}
      {lead.email && (
        <div className="muted" style={{ fontSize: '12px', marginBottom: '2px' }}>
          ✉️ {lead.email}
        </div>
      )}
      {lead.source && (
        <div className="muted" style={{ fontSize: '12px' }}>
          Fuente: {lead.source}
        </div>
      )}
    </div>
  )
}
