import { useNavigate } from 'react-router-dom'
import type { Lead } from '../../features/pipeline/pipeline.api'
import { getStageAccentStyle } from '../../shared/utils/stageStyles'
import type { PipelineStageLite } from './LeadProgressDots'
import { LeadCardContent } from './LeadCardContent'
import { MoveStageButton } from './MoveStageButton'

export function LeadCardMobile({
  lead,
  stages,
  stageName,
  isHighlight,
  onRowClick,
  onMoveStage,
  onToast,
}: {
  lead: Lead
  stages: PipelineStageLite[]
  stageName: string | undefined
  isHighlight?: boolean
  onRowClick?: (lead: Lead) => void
  onMoveStage?: (leadId: string, toStageId: string) => Promise<void>
  onToast?: (message: string) => void
}) {
  const navigate = useNavigate()

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        navigate(`/leads/${lead.id}`)
        onRowClick?.(lead)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          navigate(`/leads/${lead.id}`)
          onRowClick?.(lead)
        }
      }}
      className={`rounded-xl border border-neutral-200 bg-white px-2.5 py-2 shadow-sm active:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200 ${
        isHighlight ? 'ring-2 ring-primary/40 bg-primary/5' : ''
      }`}
      style={getStageAccentStyle(stageName)}
    >
      <LeadCardContent lead={lead} stages={stages} stageName={stageName} onToast={onToast} />

      {onMoveStage ? (
        <div className="mt-2 min-h-[40px] flex items-center" onClick={(e) => e.stopPropagation()}>
          <MoveStageButton
            lead={lead}
            stages={stages}
            onMoveStage={onMoveStage}
            className="w-full"
            buttonClassName="w-full min-h-[40px] inline-flex items-center justify-center gap-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200"
          />
        </div>
      ) : null}
    </div>
  )
}
