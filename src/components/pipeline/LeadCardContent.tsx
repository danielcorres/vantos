import type { Lead } from '../../features/pipeline/pipeline.api'
import { IconMail, IconPhone, IconUser } from '../../app/layout/icons'
import { LeadContactLine } from './LeadContactLine'
import { LeadProgressDots, type PipelineStageLite } from './LeadProgressDots'
import { LeadSourceTag } from './LeadSourceTag'

/**
 * Contenido reutilizable de card de lead (sin contenedor).
 * Usado en LeadCardMobile (tabla móvil + kanban móvil) y en cards del Kanban desktop.
 * Mismo layout: nombre + contacto + fuente + progreso.
 */
export function LeadCardContent({
  lead,
  stages,
  stageName: _stageName,
  onToast,
}: {
  lead: Lead
  stages: PipelineStageLite[]
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
      {/* Nombre con icono pill (igual que tabla/card móvil) */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-neutral-600 shrink-0">
          <IconUser className="w-4 h-4" />
        </span>
        <div className="min-w-0 font-medium text-neutral-900 truncate text-sm">{lead.full_name}</div>
      </div>

      {/* Tel / email (reusando LeadContactLine) */}
      {(phone || email) && (
        <div className="mt-2 space-y-1" onClick={(e) => e.stopPropagation()}>
          {phone ? (
            <LeadContactLine
              icon={<IconPhone className="w-4 h-4 text-neutral-500" />}
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
              icon={<IconMail className="w-4 h-4 text-neutral-500" />}
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

      {/* Fuente + Progreso */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <LeadSourceTag source={lead.source} />
        <LeadProgressDots stages={stages} currentStageId={lead.stage_id} />
      </div>
    </>
  )
}
