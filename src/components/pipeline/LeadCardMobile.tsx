import { useNavigate } from 'react-router-dom'
import type { Lead } from '../../features/pipeline/pipeline.api'
import { getStageAccentStyle } from '../../shared/utils/stageStyles'
import { isLikelyNeverMoved } from '../../shared/utils/leadUtils'
import type { PipelineStageLite } from './LeadProgressDots'
import { LeadCardContent } from './LeadCardContent'
import { LeadSourceTag } from './LeadSourceTag'
import { MoveStageButton } from './MoveStageButton'

export type LeadCardMobileVariant = 'default' | 'kanban' | 'table'

export function LeadCardMobile({
  lead,
  stages,
  stageName,
  isHighlight,
  onRowClick,
  onMoveStage,
  onToast,
  variant = 'default',
}: {
  lead: Lead
  stages: PipelineStageLite[]
  stageName: string | undefined
  isHighlight?: boolean
  onRowClick?: (lead: Lead) => void
  onMoveStage?: (leadId: string, toStageId: string) => Promise<void>
  onToast?: (message: string) => void
  variant?: LeadCardMobileVariant
}) {
  const navigate = useNavigate()

  const handleClick = () => {
    navigate(`/leads/${lead.id}`)
    onRowClick?.(lead)
  }

  const isCompact = variant === 'kanban' || variant === 'table'
  const paddingClass = isCompact ? 'px-3 py-2' : 'px-2.5 py-2'

  const moveButtonBlock = onMoveStage && stages.length > 0 && (
    <div
      className={variant === 'table' ? 'mt-1.5' : 'mt-2'}
      role="presentation"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <MoveStageButton
        lead={lead}
        stages={stages}
        onMoveStage={onMoveStage}
        className="w-full"
        buttonClassName="w-full min-h-[36px] inline-flex items-center justify-center gap-1 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200"
      />
    </div>
  )

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
      className={`rounded-xl border border-neutral-200 bg-white shadow-sm active:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200 ${paddingClass} ${
        isHighlight ? 'ring-2 ring-primary/40 bg-primary/5' : ''
      }`}
      style={getStageAccentStyle(stageName)}
    >
      {variant === 'kanban' && (
        <>
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0 truncate font-medium text-neutral-900 text-sm">
              {lead.full_name}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <LeadSourceTag source={lead.source} className="shrink-0" />
            {isLikelyNeverMoved(lead) && (
              <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                Nuevo
              </span>
            )}
          </div>
          {moveButtonBlock}
        </>
      )}

      {variant === 'table' && (
        <>
          <div className="flex items-start justify-between gap-2">
            <span className="min-w-0 truncate font-medium text-neutral-900 text-sm">
              {lead.full_name}
            </span>
          </div>
          {moveButtonBlock}
        </>
      )}

      {variant === 'default' && (
        <>
          <LeadCardContent lead={lead} stages={stages} stageName={stageName} onToast={onToast} />
          {onMoveStage ? (
            <div
              className="mt-2 min-h-[40px] flex items-center"
              role="presentation"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              <MoveStageButton
                lead={lead}
                stages={stages}
                onMoveStage={onMoveStage}
                className="w-full"
                buttonClassName="w-full min-h-[40px] inline-flex items-center justify-center gap-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200"
              />
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
