import type { Lead, PipelineStage } from '../pipeline.api'
import { LeadCardContent } from '../../../components/pipeline/LeadCardContent'

interface LeadCardProps {
  lead: Lead
  stages: PipelineStage[]
  stageName: string | undefined
  onDragStart: (e: React.DragEvent, lead: Lead) => void
}

export function LeadCard({ lead, stages, stageName, onDragStart }: LeadCardProps) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      className="group rounded-xl border border-neutral-200 bg-white p-3 shadow-sm transition-colors cursor-grab hover:border-neutral-300 hover:shadow-md active:cursor-grabbing"
    >
      <LeadCardContent lead={lead} stages={stages} stageName={stageName} />
    </div>
  )
}
