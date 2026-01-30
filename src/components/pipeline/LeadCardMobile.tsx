import { useNavigate } from 'react-router-dom'
import type { Lead } from '../../features/pipeline/pipeline.api'
import { getStageAccentStyle } from '../../shared/utils/stageStyles'
import { IconMail, IconPhone, IconUser } from '../../app/layout/icons'
import { LeadContactLine } from './LeadContactLine'
import { LeadProgressDots, type PipelineStageLite } from './LeadProgressDots'
import { LeadSourceTag } from './LeadSourceTag'
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

  const phone = lead.phone?.trim() ?? ''
  const email = lead.email?.trim() ?? ''

  const handleCopy = (text: string, toastMessage: string) => {
    void navigator.clipboard.writeText(text).then(() => onToast?.(toastMessage))
  }

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
      className={`rounded-xl border border-neutral-200 bg-white px-3 py-3 shadow-sm active:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200 ${
        isHighlight ? 'ring-2 ring-primary/40 bg-primary/5' : ''
      }`}
      style={getStageAccentStyle(stageName)}
    >
      {/* Header: nombre */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 shrink-0">
          <IconUser className="w-4 h-4" />
        </span>
        <div className="min-w-0">
          <div className="font-medium text-neutral-900 truncate">{lead.full_name}</div>
        </div>
      </div>

      {/* Contact */}
      {(phone || email) && (
        <div className="mt-2 space-y-1" onClick={(e) => e.stopPropagation()}>
          {phone ? (
            <LeadContactLine
              icon={<IconPhone className="w-4 h-4 text-neutral-500" />}
              value={phone}
              ariaLabel="Copiar teléfono"
              onCopy={handleCopy}
              copyMessage="Teléfono copiado"
              compact
              showCopyAlways
            />
          ) : null}
          {email ? (
            <LeadContactLine
              icon={<IconMail className="w-4 h-4 text-neutral-500" />}
              value={email}
              ariaLabel="Copiar email"
              onCopy={handleCopy}
              copyMessage="Email copiado"
              compact
              showCopyAlways
            />
          ) : null}
        </div>
      )}

      {/* Meta */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <LeadSourceTag source={lead.source} />
        <LeadProgressDots stages={stages} currentStageId={lead.stage_id} />
      </div>

      {/* Acción */}
      {onMoveStage ? (
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
          <MoveStageButton
            lead={lead}
            stages={stages}
            onMoveStage={onMoveStage}
            className="w-full"
            buttonClassName="w-full inline-flex items-center justify-center gap-1 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200"
          />
        </div>
      ) : null}
    </div>
  )
}
