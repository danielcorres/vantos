import { useNavigate } from 'react-router-dom'
import type { Lead, PipelineStage } from '../pipeline.api'
import { MoveStageButton } from '../../../components/pipeline/MoveStageButton'
import { LeadSourceTag } from '../../../components/pipeline/LeadSourceTag'
import { NextActionActions } from '../../../components/pipeline/NextActionActions'
import { isLikelyNeverMoved } from '../../../shared/utils/leadUtils'
import type { PipelineStageLite } from '../../../components/pipeline/LeadProgressDots'

interface LeadCardProps {
  lead: Lead
  stages: PipelineStage[]
  stageName: string | undefined
  onDragStart: (e: React.DragEvent, lead: Lead) => void
  onMoveStage?: (leadId: string, toStageId: string) => Promise<void>
  onToast?: (message: string) => void
  onUpdated?: () => void | Promise<void>
}

const stagesToLite = (stages: PipelineStage[]): PipelineStageLite[] =>
  stages.map((s) => ({ id: s.id, name: s.name, position: s.position }))

export function LeadCard({ lead, stages, onDragStart, onMoveStage, onToast, onUpdated }: LeadCardProps) {
  const navigate = useNavigate()
  const stagesLite = stagesToLite(stages)

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
      className="group rounded-xl border border-neutral-200 bg-white p-2 shadow-sm transition-colors cursor-grab hover:border-neutral-300 hover:shadow-md active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200 focus-visible:ring-offset-1"
    >
      {/* Fila superior: nombre · badge + botón Mover etapa */}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
          <span className="truncate font-medium text-neutral-900 text-sm">{lead.full_name}</span>
          {lead.source && (
            <>
              <span className="text-neutral-400 shrink-0">·</span>
              <LeadSourceTag source={lead.source} abbreviated className="shrink-0" />
            </>
          )}
          {isLikelyNeverMoved(lead) && (
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
              Nuevo
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
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
                buttonClassName="shrink-0 inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50 hover:border-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200"
              />
            </div>
          ) : null}
        </div>
      </div>
      {/* Próximo paso en una línea */}
      <div className="mt-1.5 flex items-center min-w-0">
        <NextActionActions
          leadId={lead.id}
          nextActionAt={lead.next_action_at}
          nextActionType={lead.next_action_type}
          onUpdated={onUpdated}
          onToast={onToast}
        />
      </div>
    </div>
  )
}
