import { useNavigate } from 'react-router-dom'
import type { Lead, PipelineStage } from '../pipeline.api'
import { MoveStageButton } from '../../../components/pipeline/MoveStageButton'
import { LeadSourceTag } from '../../../components/pipeline/LeadSourceTag'
import { isLikelyNeverMoved } from '../../../shared/utils/leadUtils'
import { getLeadMainTag, getTagClass } from '../../../shared/utils/leadTags'
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

export function LeadCard({ lead, stages, stageName, onDragStart, onMoveStage }: LeadCardProps) {
  const navigate = useNavigate()
  const stagesLite = stagesToLite(stages)
  const mainTag = getLeadMainTag(lead, stageName)

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead)}
      onClick={() => navigate(`/leads/${lead.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/leads/${lead.id}`)
        }
      }}
      className="group rounded-xl border border-neutral-200 bg-white p-3 shadow-sm transition-colors cursor-grab hover:border-neutral-300 hover:shadow-md active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200 focus-visible:ring-offset-1"
    >
      {/* Fila superior: nombre (clicable) + botón Mover etapa (no propaga click) */}
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate font-medium text-neutral-900 text-sm">
          {lead.full_name}
        </span>
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
      {/* Debajo: mainTag + fuente + badge Nuevo (Kanban: no conditionTag) */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className={getTagClass(mainTag)}>{mainTag.label}</span>
        <LeadSourceTag source={lead.source} className="shrink-0" />
        {isLikelyNeverMoved(lead) && (
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
            Nuevo
          </span>
        )}
      </div>
    </div>
  )
}
