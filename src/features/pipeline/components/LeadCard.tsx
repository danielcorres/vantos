import { useNavigate } from 'react-router-dom'
import type { Lead, PipelineStage } from '../pipeline.api'
import type { CalendarEvent } from '../../calendar/types/calendar.types'
import type { SchedulingGuidance } from '../../calendar/utils/stageSchedulingGuidance'
import { LeadSourceTag } from '../../../components/pipeline/LeadSourceTag'
import { LeadTemperatureChip } from '../../../components/pipeline/LeadTemperatureChip'
import { LeadKanbanNextTouch } from '../../../components/pipeline/LeadKanbanNextTouch'
import { LeadCardMenu } from '../../../components/pipeline/LeadCardMenu'
import { isLikelyNeverMoved } from '../../../shared/utils/leadUtils'
import { getEffectiveNextTouchUrgency, type NextTouchUrgency } from '../utils/effectiveNextTouch'
import type { PipelineStageLite } from '../../../components/pipeline/LeadProgressDots'

const URGENCY_BAR: Record<NextTouchUrgency, string> = {
  overdue: 'bg-red-500',
  today: 'bg-emerald-500',
  tomorrow: 'bg-amber-500',
  future: 'bg-neutral-300',
  none: '',
}

interface LeadCardProps {
  lead: Lead
  stages: PipelineStage[]
  /** Próxima cita programada (calendario). */
  nextAppointment?: CalendarEvent | null
  schedulingGuidance?: SchedulingGuidance
  onDragStart: (e: React.DragEvent, lead: Lead) => void
  onMoveStage?: (leadId: string, toStageId: string) => Promise<void>
  onToast?: (message: string) => void
  onUpdated?: () => void | Promise<void>
  onSchedule?: (leadId: string) => void
}

const stagesToLite = (stages: PipelineStage[]): PipelineStageLite[] =>
  stages.map((s) => ({ id: s.id, name: s.name, position: s.position }))

export function LeadCard({
  lead,
  stages,
  nextAppointment,
  schedulingGuidance,
  onDragStart,
  onMoveStage,
  onToast: _onToast,
  onUpdated: _onUpdated,
  onSchedule,
}: LeadCardProps) {
  const navigate = useNavigate()
  const stagesLite = stagesToLite(stages)
  const urgency = getEffectiveNextTouchUrgency(nextAppointment)
  const barClass = URGENCY_BAR[urgency]

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-stop-rowclick="true"]')) return
        navigate(`/leads/${lead.id}`)
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if ((e.target as HTMLElement).closest('[data-stop-rowclick="true"]')) return
          navigate(`/leads/${lead.id}`)
        }
      }}
      className={`group relative rounded-lg border border-neutral-200 bg-white px-2.5 py-2 shadow-sm transition-colors cursor-grab hover:border-neutral-300 hover:shadow-md active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200 focus-visible:ring-offset-1 ${barClass ? 'pl-3.5' : ''}`}
    >
      {barClass && (
        <div
          className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full ${barClass}`}
          aria-hidden
        />
      )}
      <div className="flex items-start gap-1 min-w-0">
        <div className="min-w-0 flex-1">
          <span className="truncate block font-medium text-neutral-900 text-sm leading-tight">
            {lead.full_name}
          </span>
        </div>
        <LeadCardMenu lead={lead} stages={stagesLite} onMoveStage={onMoveStage} />
      </div>
      <div className="flex items-center gap-1 flex-wrap mt-1">
        {lead.source && (
          <LeadSourceTag source={lead.source} abbreviated className="shrink-0" />
        )}
        <LeadTemperatureChip temperature={lead.temperature} showPlaceholder />
        {isLikelyNeverMoved(lead) && (
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-emerald-600 bg-emerald-50/80 px-1.5 py-0.5 rounded">
            Nuevo
          </span>
        )}
      </div>
      <div className="mt-1.5 flex items-center min-w-0">
        <LeadKanbanNextTouch
          leadId={lead.id}
          nextAppointment={nextAppointment}
          schedulingGuidance={schedulingGuidance}
          onSchedule={onSchedule}
          variant="kanban"
        />
      </div>
    </div>
  )
}
