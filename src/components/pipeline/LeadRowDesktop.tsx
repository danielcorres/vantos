import { useNavigate } from 'react-router-dom'
import type { Lead } from '../../features/pipeline/pipeline.api'
import { getStageAccentStyle } from '../../shared/utils/stageStyles'
import { isLikelyNeverMoved } from '../../shared/utils/leadUtils'
import {
  getLeadConditionTag,
  getTagClass,
  getRowBorderClassFromCondition,
} from '../../shared/utils/leadTags'
import { IconMail, IconPhone, IconUser } from '../../app/layout/icons'
import { LeadContactLine } from './LeadContactLine'
import { LeadProgressDots, type PipelineStageLite } from './LeadProgressDots'
import { LeadSourceTag } from './LeadSourceTag'
import { MoveStageButton } from './MoveStageButton'
import { getNextActionLabel } from '../../shared/utils/nextAction'
import { LeadQuickActions } from './LeadQuickActions'

export function LeadRowDesktop({
  lead,
  stages,
  stageName,
  isHighlight,
  onRowClick,
  onMoveStage,
  onToast,
  onUpdated,
}: {
  lead: Lead
  stages: PipelineStageLite[]
  stageName: string | undefined
  isHighlight?: boolean
  onRowClick?: (lead: Lead) => void
  onMoveStage?: (leadId: string, toStageId: string) => Promise<void>
  onToast?: (message: string) => void
  onUpdated?: () => void | Promise<void>
}) {
  const navigate = useNavigate()

  const phone = lead.phone?.trim() ?? ''
  const email = lead.email?.trim() ?? ''

  const handleCopy = (text: string, toastMessage: string) => {
    void navigator.clipboard.writeText(text).then(() => onToast?.(toastMessage))
  }

  const shouldIgnoreRowClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    const target = e.target as HTMLElement
    return !!target.closest(
      'button, a, input, select, textarea, [role="menu"], [role="menuitem"], [data-stop-rowclick="true"]'
    )
  }

  const handleRowClick = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e && shouldIgnoreRowClick(e)) return
    navigate(`/leads/${lead.id}`)
    onRowClick?.(lead)
  }

  const conditionTag = getLeadConditionTag(lead)
  const rowBorderClass = getRowBorderClassFromCondition(lead)

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={(e) => handleRowClick(e)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleRowClick(e)
        }
      }}
      className={`group select-none cursor-pointer bg-white transition-colors hover:bg-neutral-50 focus-within:bg-neutral-50 focus-within:ring-2 focus-within:ring-neutral-200 focus-within:ring-inset focus-visible:outline-none ${rowBorderClass} ${
        isHighlight ? 'ring-2 ring-primary/40 ring-inset bg-primary/5' : ''
      }`}
      style={getStageAccentStyle(stageName)}
    >
      {/* Nombre: nombre + fuente debajo + badge Nuevo — min-w-0 + truncate para prioridad sin widths fijos */}
      <td className="px-4 py-3 align-middle border-b border-dashed border-neutral-200/60 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 shrink-0">
            <IconUser className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="truncate font-medium text-neutral-900">{lead.full_name}</span>
              {isLikelyNeverMoved(lead) && (
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                  Nuevo
                </span>
              )}
            </div>
            <div className="mt-1">
              <LeadSourceTag source={lead.source} />
            </div>
            <div className="text-xs text-neutral-500 mt-1">
              Siguiente: {getNextActionLabel(lead.next_action_at)}
            </div>
          </div>
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

      {/* Email — oculto en desktop angosto para priorizar nombre */}
      <td className="px-4 py-3 align-middle border-b border-dashed border-neutral-200/60 max-w-[320px] hidden xl:table-cell">
        <LeadContactLine
          icon={<IconMail className="w-4 h-4 text-neutral-500" />}
          value={email}
          ariaLabel="Copiar email"
          onCopy={handleCopy}
          copyMessage="Email copiado"
        />
      </td>

      {/* Progreso — oculto en desktop angosto (lg) para priorizar nombre */}
      <td className="hidden lg:table-cell px-4 py-3 align-middle border-b border-dashed border-neutral-200/60">
        <LeadProgressDots stages={stages} currentStageId={lead.stage_id} />
      </td>

      {/* Estado: solo condición (si existe) + Quick Actions — pipeline puro sin estados micro */}
      <td className="px-4 py-3 align-middle border-b border-dashed border-neutral-200/60">
        <div className="flex flex-col items-start gap-1">
          {conditionTag && (
            <span className={getTagClass(conditionTag)}>{conditionTag.label}</span>
          )}
          <LeadQuickActions
            lead={lead}
            stageName={stageName}
            onUpdated={onUpdated}
            onToast={onToast}
          />
        </div>
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
