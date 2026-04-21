import type { Lead } from '../../features/pipeline/pipeline.api'
import { isLikelyNeverMoved } from '../../shared/utils/leadUtils'
import { IconMail, IconPhone, IconUser } from '../../app/layout/icons'
import { LeadContactLine } from './LeadContactLine'
import { LeadProgressDots, type PipelineStageLite } from './LeadProgressDots'
import { LeadSourceTag } from './LeadSourceTag'
import { LeadTemperatureChip } from './LeadTemperatureChip'

/**
 * Contenido reutilizable de card de lead (sin contenedor).
 * Usado en LeadCardMobile (tabla móvil + kanban móvil) y en cards del Kanban desktop.
 * Mismo layout: nombre + contacto + fuente + progreso.
 */
export function LeadCardContent({
  lead,
  stages,
  onToast,
}: {
  lead: Lead
  stages: PipelineStageLite[]
  /** Aceptado por compatibilidad con callers; no se usa en este contenido. */
  stageName?: string
  onToast?: (message: string) => void
}) {
  const phone = lead.phone?.trim() ?? ''
  const email = lead.email?.trim() ?? ''

  const handleCopy = (text: string, toastMessage: string) => {
    void navigator.clipboard.writeText(text).then(() => onToast?.(toastMessage))
  }

  return (
    <>
      {/* Nombre con icono pill — más compacto en móvil */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 shrink-0">
          <IconUser className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="truncate font-medium text-neutral-900 text-xs sm:text-sm">{lead.full_name}</span>
            {isLikelyNeverMoved(lead) && (
              <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">
                Nuevo
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tel / email — menos espacio en móvil */}
      {(phone || email) && (
        <div className="mt-1.5 sm:mt-2 space-y-0.5 sm:space-y-1" onClick={(e) => e.stopPropagation()}>
          {phone ? (
            <LeadContactLine
              icon={<IconPhone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-500" />}
              value={phone}
              ariaLabel="Copiar teléfono"
              onCopy={onToast ? handleCopy : undefined}
              copyMessage="Teléfono copiado"
              compact
              showCopyAlways
            />
          ) : null}
          {email ? (
            <LeadContactLine
              icon={<IconMail className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-500" />}
              value={email}
              ariaLabel="Copiar email"
              onCopy={onToast ? handleCopy : undefined}
              copyMessage="Email copiado"
              compact
              showCopyAlways
            />
          ) : null}
        </div>
      )}

      {/* Fuente (oculta en móvil) + Progreso siempre visible */}
      <div className="mt-2 sm:mt-3 flex items-center justify-between gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 min-w-0">
          <span className="hidden sm:inline-flex">
            <LeadSourceTag source={lead.source} />
          </span>
          <LeadTemperatureChip temperature={lead.temperature} />
        </span>
        <LeadProgressDots stages={stages} currentStageId={lead.stage_id} />
      </div>
    </>
  )
}
