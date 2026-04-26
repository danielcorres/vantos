import * as React from 'react'
import type { PipelineStage, Lead } from '../pipeline.api'
import type { CalendarEvent } from '../../calendar/types/calendar.types'
import type { AppointmentEditFocus } from '../../calendar/components/AppointmentFormModal'
import type { SchedulingGuidance } from '../../calendar/utils/stageSchedulingGuidance'
import { sortLeadsByEffectiveNextTouch } from '../utils/effectiveNextTouch'
import { EmptyState } from '../../../components/pipeline/EmptyState'
import { KanbanColumn } from './KanbanColumn'
import { LeadCardMobile } from '../../../components/pipeline/LeadCardMobile'
import { MobileStageSwitcher } from '../../../components/pipeline/MobileStageSwitcher'
import type { PipelineStageLite } from '../../../components/pipeline/LeadProgressDots'

interface KanbanBoardProps {
  stages: PipelineStage[]
  leads: Lead[]
  /** Próxima cita programada por lead (batch); alinea tarjetas con calendario. */
  nextAppointmentByLeadId?: Record<string, CalendarEvent | null>
  /** Guía de CTA / reprogramar por lead (slug + historial de citas). */
  schedulingGuidanceByLeadId?: Record<string, SchedulingGuidance>
  /** Totales por etapa y cuántos están cargados (Kanban paginado). */
  stageLoadMeta?: Record<string, { total: number; loaded: number }>
  loadingMoreStageId?: string | null
  onLoadMoreStage?: (stageId: string) => void | Promise<void>
  onDragStart: (e: React.DragEvent, lead: Lead) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, stageId: string) => void
  onMoveStage: (leadId: string, toStageId: string) => Promise<void>
  onCreateLead?: (stageId: string) => void
  onToast?: (message: string) => void
  onUpdated?: () => void | Promise<void>
  /** Abrir creación de cita en calendario para un lead (tarjeta Kanban). */
  onSchedule?: (leadId: string) => void
  /** Editar cita desde chips (fecha/hora o estado). */
  onEditAppointment?: (args: {
    leadId: string
    event: CalendarEvent
    focus: AppointmentEditFocus
  }) => void
}

const EMPTY_APPOINTMENTS: Record<string, CalendarEvent | null> = {}
const EMPTY_GUIDANCE: Record<string, SchedulingGuidance> = {}

export function KanbanBoard({
  stages,
  leads,
  nextAppointmentByLeadId = EMPTY_APPOINTMENTS,
  schedulingGuidanceByLeadId = EMPTY_GUIDANCE,
  stageLoadMeta = {},
  loadingMoreStageId = null,
  onLoadMoreStage,
  onDragStart,
  onDragOver,
  onDrop,
  onMoveStage,
  onCreateLead,
  onToast,
  onUpdated,
  onSchedule,
  onEditAppointment,
}: KanbanBoardProps) {
  const stageItems = React.useMemo(
    () => stages.map((s) => ({ id: s.id, name: s.name, position: s.position })),
    [stages]
  )

  const stagesLite: PipelineStageLite[] = React.useMemo(
    () => stageItems.map((s) => ({ id: s.id, name: s.name, position: s.position })),
    [stageItems]
  )

  const STORAGE_KEY = 'vant.pipeline.kanban.mobileStageId'
  const [mobileStageId, setMobileStageId] = React.useState<string>(() => {
    if (typeof window === 'undefined') return stages[0]?.id ?? ''
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved || stages[0]?.id || ''
  })

  React.useEffect(() => {
    if (!mobileStageId) return
    try {
      window.localStorage.setItem(STORAGE_KEY, mobileStageId)
    } catch {
      // ignore
    }
  }, [mobileStageId])

  React.useEffect(() => {
    // Si las etapas cambian y el id guardado ya no existe, caer a la primera.
    if (!stages.length) return
    if (!mobileStageId || !stages.some((s) => s.id === mobileStageId)) {
      setMobileStageId(stages[0].id)
    }
  }, [stages, mobileStageId])

  const mobileLeads = React.useMemo(() => {
    const inStage = leads.filter((l) => l.stage_id === mobileStageId)
    return sortLeadsByEffectiveNextTouch(inStage, nextAppointmentByLeadId)
  }, [leads, mobileStageId, nextAppointmentByLeadId])

  const mobileStageName = React.useMemo(
    () => stages.find((s) => s.id === mobileStageId)?.name,
    [stages, mobileStageId]
  )

  const mobileStageSlug = React.useMemo(
    () => stages.find((s) => s.id === mobileStageId)?.slug,
    [stages, mobileStageId]
  )

  const leadsByStage = React.useMemo(() => {
    const map = new Map<string, Lead[]>()
    for (const lead of leads) {
      const list = map.get(lead.stage_id)
      if (list) list.push(lead)
      else map.set(lead.stage_id, [lead])
    }
    return map
  }, [leads])

  const emptyLeads: Lead[] = React.useMemo(() => [], [])

  return (
    <>
      {/* MOBILE: una columna a la vez (sin drag & drop) */}
      <div className="md:hidden">
        <MobileStageSwitcher
          stages={stageItems}
          value={mobileStageId}
          onChange={setMobileStageId}
          count={mobileLeads.length}
          label="Pipeline"
        />

        <div className="px-3 py-3 space-y-2">
          {mobileLeads.length === 0 ? (
            <EmptyState
              title="No hay leads en esta etapa"
              subtitle="Puedes crear uno directamente aquí."
              actionLabel="+ Nuevo lead"
              onAction={() => onCreateLead?.(mobileStageId)}
              variant="dashed"
            />
          ) : (
            <div
              key={mobileStageId}
              className="space-y-2 motion-safe:animate-fade-in-up motion-reduce:animate-none"
            >
              {mobileLeads.map((lead) => (
                <LeadCardMobile
                  key={lead.id}
                  lead={lead}
                  stages={stagesLite}
                  stageName={mobileStageName}
                  stageSlug={mobileStageSlug}
                  nextAppointment={nextAppointmentByLeadId[lead.id] ?? null}
                  schedulingGuidance={schedulingGuidanceByLeadId[lead.id]}
                  onMoveStage={onMoveStage}
                  onToast={onToast}
                  onUpdated={onUpdated}
                  onSchedule={onSchedule}
                  onEditAppointment={onEditAppointment}
                  variant="kanban"
                />
              ))}
              {(() => {
                const meta = stageLoadMeta[mobileStageId]
                const hasMore = meta != null && meta.loaded < meta.total
                if (!hasMore || !onLoadMoreStage) return null
                return (
                  <button
                    type="button"
                    onClick={() => void onLoadMoreStage(mobileStageId)}
                    disabled={loadingMoreStageId === mobileStageId}
                    className="w-full rounded-lg border border-dashed border-neutral-300 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50 disabled:opacity-50"
                  >
                    {loadingMoreStageId === mobileStageId
                      ? 'Cargando…'
                      : `Cargar más (${meta.loaded} de ${meta.total})`}
                  </button>
                )
              })()}
            </div>
          )}
        </div>
      </div>

      {/* DESKTOP: tablero completo con drag & drop (se mantiene) */}
      <div className="hidden md:block -mx-4 px-4 pb-4 overflow-x-auto">
        <div className="flex gap-3 items-start min-w-max">
          {stages.map((stage) => {
            const meta = stageLoadMeta[stage.id]
            return (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                stages={stages}
                leads={leadsByStage.get(stage.id) ?? emptyLeads}
                nextAppointmentByLeadId={nextAppointmentByLeadId}
                schedulingGuidanceByLeadId={schedulingGuidanceByLeadId}
                totalInStage={meta?.total}
                loadedInStage={meta?.loaded}
                hasMoreInStage={meta != null && meta.loaded < meta.total}
                loadingMore={loadingMoreStageId === stage.id}
                onLoadMore={onLoadMoreStage ? () => void onLoadMoreStage(stage.id) : undefined}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onMoveStage={onMoveStage}
                onToast={onToast}
                onUpdated={onUpdated}
                onSchedule={onSchedule}
                onEditAppointment={onEditAppointment}
              />
            )
          })}
        </div>
      </div>
    </>
  )
}
