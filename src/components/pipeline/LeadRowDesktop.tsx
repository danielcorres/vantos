import { useNavigate } from 'react-router-dom'
import type { Lead } from '../../features/pipeline/pipeline.api'
import { getStageAccentStyle } from '../../shared/utils/stageStyles'
import { IconMail, IconPhone, IconUser } from '../../app/layout/icons'
import { LeadContactLine } from './LeadContactLine'
import { LeadProgressDots, type PipelineStageLite } from './LeadProgressDots'
import { LeadSourceTag } from './LeadSourceTag'
import { MoveStageButton } from './MoveStageButton'

export function LeadRowDesktop({
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

  const handleRowClick = () => {
    navigate(`/leads/${lead.id}`)
    onRowClick?.(lead)
  }

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleRowClick()
        }
      }}
      className={`group select-none cursor-pointer bg-white transition-colors hover:bg-neutral-50 focus-within:bg-neutral-50 focus-within:ring-2 focus-within:ring-neutral-200 focus-within:ring-inset focus-visible:outline-none ${
        isHighlight ? 'ring-2 ring-primary/40 ring-inset bg-primary/5' : ''
      }`}
      style={getStageAccentStyle(stageName)}
    >
      {/* Nombre */}
      <td className="px-4 py-3 align-middle border-b border-dashed border-neutral-200/60">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 shrink-0">
            <IconUser className="w-4 h-4" />
          </span>
          <span className="min-w-0 truncate font-medium text-neutral-900">{lead.full_name}</span>
        </div>
      </td>

      {/* Teléfono */}
      <td className="px-4 py-3 align-middle border-b border-dashed border-neutral-200/60 max-w-[220px]">
        <LeadContactLine
          icon={<IconPhone className="w-4 h-4 text-neutral-500" />}
          value={phone}
          ariaLabel="Copiar teléfono"
          onCopy={handleCopy}
          copyMessage="Teléfono copiado"
        />
      </td>

      {/* Email */}
      <td className="px-4 py-3 align-middle border-b border-dashed border-neutral-200/60 max-w-[320px]">
        <LeadContactLine
          icon={<IconMail className="w-4 h-4 text-neutral-500" />}
          value={email}
          ariaLabel="Copiar email"
          onCopy={handleCopy}
          copyMessage="Email copiado"
        />
      </td>

      {/* Progreso */}
      <td className="px-4 py-3 align-middle border-b border-dashed border-neutral-200/60">
        <LeadProgressDots stages={stages} currentStageId={lead.stage_id} />
      </td>

      {/* Fuente */}
      <td className="px-4 py-3 align-middle border-b border-dashed border-neutral-200/60">
        <LeadSourceTag source={lead.source} />
      </td>

      {/* Acción */}
      <td className="px-4 py-3 align-middle border-b border-dashed border-neutral-200/60 text-right">
        {onMoveStage ? (
          <div className="inline-flex justify-end opacity-100 sm:opacity-70 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <MoveStageButton lead={lead} stages={stages} onMoveStage={onMoveStage} />
          </div>
        ) : (
          <span className="text-sm text-neutral-400">—</span>
        )}
      </td>
    </tr>
  )
}
