import React, { useState, useMemo } from 'react'
import type { PipelineStage, Lead } from '../pipeline.api'
import type { CalendarEvent } from '../../calendar/types/calendar.types'
import type { SchedulingGuidance } from '../../calendar/utils/stageSchedulingGuidance'
import { EmptyState } from '../../../components/pipeline/EmptyState'
import { InfoPopover } from '../../../shared/components/InfoPopover'
import { LeadCard } from './LeadCard'
import { sortLeadsByEffectiveNextTouch } from '../utils/effectiveNextTouch'
import { getStageHelp } from '../utils/stageHelp'
import { displayStageName } from '../../../shared/utils/stageStyles'

interface KanbanColumnProps {
  stage: PipelineStage
  stages: PipelineStage[]
  leads: Lead[]
  /** Próxima cita programada por lead_id (batch desde calendario). */
  nextAppointmentByLeadId?: Record<string, CalendarEvent | null>
  schedulingGuidanceByLeadId?: Record<string, SchedulingGuidance>
  /** Total en servidor para esta etapa (cabecera). Si no viene, se usa leads.length. */
  totalInStage?: number
  loadedInStage?: number
  hasMoreInStage?: boolean
  loadingMore?: boolean
  onLoadMore?: () => void | Promise<void>
  onDragStart: (e: React.DragEvent, lead: Lead) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, stageId: string) => void
  onMoveStage?: (leadId: string, toStageId: string) => Promise<void>
  onToast?: (message: string) => void
  onUpdated?: () => void | Promise<void>
  onSchedule?: (leadId: string) => void
}

const EMPTY_APPOINTMENTS: Record<string, CalendarEvent | null> = {}
const EMPTY_GUIDANCE: Record<string, SchedulingGuidance> = {}

function KanbanColumnInner({
  stage,
  stages,
  leads,
  nextAppointmentByLeadId = EMPTY_APPOINTMENTS,
  schedulingGuidanceByLeadId = EMPTY_GUIDANCE,
  totalInStage,
  loadedInStage,
  hasMoreInStage,
  loadingMore,
  onLoadMore,
  onDragStart,
  onDragOver,
  onDrop,
  onMoveStage,
  onToast,
  onUpdated,
  onSchedule,
}: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  const sortedLeads = useMemo(
    () => sortLeadsByEffectiveNextTouch(leads, nextAppointmentByLeadId),
    [leads, nextAppointmentByLeadId]
  )
  const stageHelp = useMemo(() => getStageHelp(stage.slug ?? stage.name), [stage.slug, stage.name])
  const headerTotal = totalInStage ?? leads.length
  const showPartialHint =
    typeof loadedInStage === 'number' &&
    typeof totalInStage === 'number' &&
    totalInStage > 0 &&
    loadedInStage < totalInStage

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
        <div className="mb-2 flex items-center gap-1.5">
          <span className="text-base font-semibold text-neutral-800">
            {displayStageName(stage.name)}
          </span>
          <InfoPopover
            title={displayStageName(stage.name)}
            bullets={stageHelp.bullets}
            tip={stageHelp.tip}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="tabular-nums text-neutral-400">
            {headerTotal} leads
            {showPartialHint ? (
              <span className="text-neutral-400 font-normal"> · mostrando {loadedInStage}</span>
            ) : null}
          </span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-[200px] p-2">
        {sortedLeads.length === 0 ? (
          <div className="py-4">
            <EmptyState title="Sin leads" variant="dashed" />
          </div>
        ) : (
          <div className="space-y-1.5">
            {sortedLeads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                stages={stages}
                nextAppointment={nextAppointmentByLeadId[lead.id] ?? null}
                schedulingGuidance={schedulingGuidanceByLeadId[lead.id]}
                onDragStart={onDragStart}
                onMoveStage={onMoveStage}
                onToast={onToast}
                onUpdated={onUpdated}
                onSchedule={onSchedule}
              />
            ))}
            {hasMoreInStage && onLoadMore ? (
              <button
                type="button"
                onClick={() => void onLoadMore()}
                disabled={loadingMore}
                className="mt-1 w-full rounded-lg border border-dashed border-neutral-300 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
              >
                {loadingMore
                  ? 'Cargando…'
                  : `Cargar más${typeof loadedInStage === 'number' && typeof totalInStage === 'number' ? ` (${loadedInStage} de ${totalInStage})` : ''}`}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

export const KanbanColumn = React.memo(KanbanColumnInner)
