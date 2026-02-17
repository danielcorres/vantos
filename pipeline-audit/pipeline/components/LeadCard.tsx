import { useNavigate } from 'react-router-dom'
import type { Lead, PipelineStage } from '../pipeline.api'
import { MoveStageButton } from '../../../components/pipeline/MoveStageButton'
import { LeadSourceTag } from '../../../components/pipeline/LeadSourceTag'
import { NextActionActions } from '../../../components/pipeline/NextActionActions'
import { isLikelyNeverMoved } from '../../../shared/utils/leadUtils'
import { isSinRespuesta } from '../../../shared/utils/nextAction'
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

  const isPorDefinir = lead.momento_override === 'por_definir'
  const isSinResp = lead.next_action_at ? isSinRespuesta(lead.next_action_at) : false

  const cardBorderClass = isSinResp
    ? 'border-red-300 bg-red-50/30'
    : isPorDefinir
      ? 'border-amber-300'
      : 'border-neutral-200 bg-white'

  const momentoLabel = isPorDefinir ? (
    <span className="shrink-0 text-xs rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-amber-800">
      Por definir
    </span>
  ) : isSinResp ? (
    <span className="shrink-0 text-xs rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-red-700">
      Sin respuesta
    </span>
  ) : null

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
      className={`group rounded-xl border p-3 shadow-sm transition-colors cursor-grab hover:border-neutral-300 hover:shadow-md active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200 focus-visible:ring-offset-1 ${cardBorderClass}`}
    >
      {/* Fila superior: nombre + mini etiqueta Momento (si aplica) + botón Mover etapa */}
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate font-medium text-neutral-900 text-sm">
          {lead.full_name}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {momentoLabel}
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
      {/* Debajo: fuente + badge Nuevo + próximo paso (sin MomentoChip en Kanban) */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <LeadSourceTag source={lead.source} className="shrink-0" />
        {isLikelyNeverMoved(lead) && (
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
            Nuevo
          </span>
        )}
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
