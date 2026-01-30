import React, { useState, useMemo } from 'react'
import type { PipelineStage, Lead } from '../pipeline.api'
import { EmptyState } from '../../../components/pipeline/EmptyState'
import { LeadCard } from './LeadCard'
import {
  aggregateColumnCounts,
  sortLeadsBySla,
} from '../utils/slaHelpers'

interface KanbanColumnProps {
  stage: PipelineStage
  stages: PipelineStage[]
  leads: Lead[]
  onDragStart: (e: React.DragEvent, lead: Lead) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, stageId: string) => void
  onMoveStage?: (leadId: string, toStageId: string) => Promise<void>
  onToast?: (message: string) => void
}

function KanbanColumnInner({
  stage,
  stages,
  leads,
  onDragStart,
  onDragOver,
  onDrop,
  onMoveStage,
  onToast,
}: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  const sortedLeads = useMemo(() => sortLeadsBySla(leads), [leads])
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
      className={`flex min-w-[280px] max-w-[280px] flex-col max-h-[calc(100vh-220px)] rounded-xl border border-neutral-200 bg-white shadow-sm transition-all duration-200 ${
        isDragOver
          ? 'ring-2 ring-primary/40 ring-inset bg-primary/5 border-primary/30'
          : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="sticky top-0 z-10 shrink-0 border-b border-neutral-200 bg-neutral-50/95 px-4 py-3 backdrop-blur-[2px]">
        <div className="mb-2 text-base font-semibold text-neutral-800">
          {stage.name}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-neutral-500 tabular-nums">
            Total: {counts.total}
          </span>
          {counts.overdue > 0 && (
            <span
              className="inline-flex items-center rounded-md bg-red-50 px-2 py-0.5 font-semibold text-red-700"
              title="Vencidos"
            >
              Vencidos: {counts.overdue}
            </span>
          )}
          {counts.warn > 0 && (
            <span
              className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 font-semibold text-amber-700"
              title="Por vencer"
            >
              Por vencer: {counts.warn}
            </span>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-[200px] p-3">
        {sortedLeads.length === 0 ? (
          <div className="py-6">
            <EmptyState title="Sin leads" variant="dashed" />
          </div>
        ) : (
          <div className="space-y-2">
            {sortedLeads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                stages={stages}
                stageName={stage.name}
                onDragStart={onDragStart}
                onMoveStage={onMoveStage}
                onToast={onToast}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export const KanbanColumn = React.memo(KanbanColumnInner)
