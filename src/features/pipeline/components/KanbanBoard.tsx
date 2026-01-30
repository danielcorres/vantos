import type { PipelineStage, Lead } from '../pipeline.api'
import { KanbanColumn } from './KanbanColumn'

interface KanbanBoardProps {
  stages: PipelineStage[]
  leads: Lead[]
  onDragStart: (e: React.DragEvent, lead: Lead) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, stageId: string) => void
}

export function KanbanBoard({
  stages,
  leads,
  onDragStart,
  onDragOver,
  onDrop,
}: KanbanBoardProps) {
  const leadsByStage = new Map<string, Lead[]>()
  leads.forEach((lead) => {
    if (!leadsByStage.has(lead.stage_id)) {
      leadsByStage.set(lead.stage_id, [])
    }
    leadsByStage.get(lead.stage_id)!.push(lead)
  })

  return (
    <div className="-mx-4 px-4 pb-4 overflow-x-auto">
      <div className="flex gap-3 items-start min-w-max">
        {stages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            leads={leadsByStage.get(stage.id) || []}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
          />
        ))}
      </div>
    </div>
  )
}
