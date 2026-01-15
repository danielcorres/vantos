import { useState, useMemo } from 'react'
import type { PipelineStage, Lead } from '../pipeline.api'
import { LeadCard } from './LeadCard'
import {
  aggregateColumnCounts,
  sortLeadsBySla,
} from '../utils/slaHelpers'

interface KanbanColumnProps {
  stage: PipelineStage
  leads: Lead[]
  onDragStart: (e: React.DragEvent, lead: Lead) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, stageId: string) => void
}

export function KanbanColumn({
  stage,
  leads,
  onDragStart,
  onDragOver,
  onDrop,
}: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  // Sort leads by SLA urgency
  const sortedLeads = useMemo(() => sortLeadsBySla(leads), [leads])

  // Count SLA statuses for this column
  const counts = useMemo(() => aggregateColumnCounts(leads), [leads])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
    onDragOver(e)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    onDrop(e, stage.id)
  }

  return (
    <div
      className={`card ${isDragOver ? 'kanban-column-drag-over' : ''}`}
      style={{
        minWidth: '280px',
        maxWidth: '280px',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 'calc(100vh - 200px)',
        transition: 'all 0.2s',
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        style={{
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '2px solid var(--border)',
        }}
      >
        <div
          style={{
            fontWeight: '600',
            fontSize: '16px',
            marginBottom: '6px',
          }}
        >
          {stage.name}
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            alignItems: 'center',
            fontSize: '12px',
          }}
        >
          <span className="muted">Total: {counts.total}</span>
          {counts.overdue > 0 && (
            <span
              style={{
                background: '#fee',
                color: '#c33',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: '600',
              }}
              title="Vencidos"
            >
              Vencidos: {counts.overdue}
            </span>
          )}
          {counts.warn > 0 && (
            <span
              style={{
                background: '#ffe',
                color: '#c90',
                padding: '2px 6px',
                borderRadius: '4px',
                fontWeight: '600',
              }}
              title="Por vencer"
            >
              Por vencer: {counts.warn}
            </span>
          )}
        </div>
      </div>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          minHeight: '200px',
        }}
      >
        {sortedLeads.length === 0 ? (
          <div
            className="muted"
            style={{
              textAlign: 'center',
              padding: '24px',
              fontSize: '14px',
            }}
          >
            Sin leads
          </div>
        ) : (
          sortedLeads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} onDragStart={onDragStart} />
          ))
        )}
      </div>
    </div>
  )
}
