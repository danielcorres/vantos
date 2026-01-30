import type { Lead, PipelineStage } from '../pipeline.api'
import { LeadCardContent } from '../../../components/pipeline/LeadCardContent'
import { MoveStageButton } from '../../../components/pipeline/MoveStageButton'
import type { PipelineStageLite } from '../../../components/pipeline/LeadProgressDots'

interface LeadCardProps {
  lead: Lead
  stages: PipelineStage[]
  stageName: string | undefined
  onDragStart: (e: React.DragEvent, lead: Lead) => void
  onMoveStage?: (leadId: string, toStageId: string) => Promise<void>
  onToast?: (message: string) => void
}

const stagesToLite = (stages: PipelineStage[]): PipelineStageLite[] =>
  stages.map((s) => ({ id: s.id, name: s.name, position: s.position }))

export function LeadCard({ lead, stages, stageName, onDragStart, onMoveStage, onToast }: LeadCardProps) {
  const stagesLite = stagesToLite(stages)
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      className="group rounded-xl border border-neutral-200 bg-white p-3 shadow-sm transition-colors cursor-grab hover:border-neutral-300 hover:shadow-md active:cursor-grabbing"
    >
      <div className="relative">
        <div className="absolute right-0 top-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {onMoveStage && stagesLite.length > 0 ? (
            <div
              role="presentation"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <MoveStageButton
                lead={lead}
                stages={stagesLite}
                onMoveStage={onMoveStage}
                buttonClassName="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200"
              />
            </div>
          ) : null}
        </div>
        <LeadCardContent lead={lead} stages={stages} stageName={stageName} onToast={onToast} />
      </div>
    </div>
  )
}
