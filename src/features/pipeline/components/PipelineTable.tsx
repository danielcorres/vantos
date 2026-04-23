import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { Lead } from '../pipeline.api'
import type { CalendarEvent } from '../../calendar/types/calendar.types'
import type { AppointmentEditFocus } from '../../calendar/components/AppointmentFormModal'
import type { SchedulingGuidance } from '../../calendar/utils/stageSchedulingGuidance'
import { displayStageName, getStageAccentStyle } from '../../../shared/utils/stageStyles'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'

import { EmptyState } from '../../../components/pipeline/EmptyState'
import { InfoPopover } from '../../../shared/components/InfoPopover'
import { LeadCardMobile } from '../../../components/pipeline/LeadCardMobile'
import { LeadRowDesktop } from '../../../components/pipeline/LeadRowDesktop'
import type { PipelineStageLite } from '../../../components/pipeline/LeadProgressDots'
import { getStageHelp } from '../utils/stageHelp'

type Stage = PipelineStageLite & { slug?: string }

export type GroupedSection = { stage: Stage; leads: Lead[] }

type PipelineTableProps = {
  leads: Lead[]
  stages: Stage[]
  groupByStage?: boolean
  groupedSections?: GroupedSection[]
  /**
   * Si true (defecto), una sección sin leads en `groupedSections` empieza colapsada.
   * Pon false cuando los leads son una página parcial en servidor: “vacío” no implica etapa vacía en BD.
   */
  defaultCollapseEmptyStages?: boolean
  collapsedStages?: Record<string, boolean>
  onCollapsedStagesChange?: (next: Record<string, boolean>) => void
  highlightLeadId?: string | null
  onRowClick: (lead: Lead) => void
  onMoveStage?: (leadId: string, toStageId: string) => Promise<void>
  onToast?: (message: string) => void
  onUpdated?: () => void | Promise<void>
  nextAppointmentByLeadId?: Record<string, CalendarEvent | null>
  schedulingGuidanceByLeadId?: Record<string, SchedulingGuidance>
  onSchedule?: (leadId: string) => void
  onEditAppointment?: (args: {
    leadId: string
    event: CalendarEvent
    focus: AppointmentEditFocus
  }) => void
}

const TH_BASE = 'px-4 py-2 text-left text-xs font-medium text-neutral-500'

function HeaderRow() {
  return (
    <tr>
      <th className={TH_BASE}>Nombre</th>
      <th className={TH_BASE}>Teléfono</th>
      <th className={`${TH_BASE} hidden xl:table-cell`}>Email</th>
      <th className={`${TH_BASE} hidden lg:table-cell min-w-[165px]`}>Cita</th>
      <th className={`${TH_BASE} text-right`}>Acción</th>
    </tr>
  )
}

export function PipelineTable({
  leads,
  stages,
  groupByStage = false,
  groupedSections = [],
  defaultCollapseEmptyStages = true,
  collapsedStages: controlledCollapsed,
  onCollapsedStagesChange,
  highlightLeadId,
  onRowClick,
  onMoveStage,
  onToast,
  onUpdated,
  nextAppointmentByLeadId = {},
  schedulingGuidanceByLeadId = {},
  onSchedule,
  onEditAppointment,
}: PipelineTableProps) {
  const showGrouped = groupByStage && groupedSections.length > 0
  const prefersReducedMotion = useReducedMotion()
  const [internalCollapsed, setInternalCollapsed] = useState<Record<string, boolean>>({})
  const highlightRowRef = useRef<HTMLTableRowElement | null>(null)

  const isControlled = controlledCollapsed != null && onCollapsedStagesChange != null
  const collapsedStages = isControlled ? controlledCollapsed : internalCollapsed
  const setCollapsedStages = isControlled ? onCollapsedStagesChange : setInternalCollapsed
  const collapseEmptyByDefault = defaultCollapseEmptyStages

  const stageById = useMemo(() => {
    const m = new Map<string, Stage>()
    for (const s of stages) m.set(s.id, s)
    return m
  }, [stages])

  // Estado inicial (solo modo no controlado): etapas con 0 leads colapsadas (seed intencional; no re-arquitectar)
  useEffect(() => {
    if (isControlled || !showGrouped || groupedSections.length === 0) return
    setInternalCollapsed((prev) => {
      let next = prev
      for (const { stage, leads: sectionLeads } of groupedSections) {
        if (stage.id in next) continue
        next = { ...next, [stage.id]: collapseEmptyByDefault && sectionLeads.length === 0 }
      }
      return next
    })
  }, [isControlled, showGrouped, groupedSections, collapseEmptyByDefault])

  const toggleStage = (stageId: string) => {
    setCollapsedStages({ ...collapsedStages, [stageId]: !collapsedStages[stageId] })
  }

  // Scroll suave al lead destacado (respetar reduced motion)
  useEffect(() => {
    if (!highlightLeadId) return
    const el = highlightRowRef.current
    if (!el) return
    el.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'nearest' })
  }, [highlightLeadId, prefersReducedMotion])

  // =====================
  // Mobile: Cards
  // =====================
  const MobileCards = (
    <div className="md:hidden space-y-2">
      {showGrouped
        ? groupedSections.map(({ stage, leads: sectionLeads }, idx) => {
            const isCollapsed =
              collapsedStages[stage.id] ?? (collapseEmptyByDefault && sectionLeads.length === 0)
            const stageHelp = getStageHelp(stage.slug ?? stage.name)
            return (
              <Fragment key={stage.id}>
                {idx > 0 ? <div className="h-2" /> : null}
                <button
                  type="button"
                  onClick={() => toggleStage(stage.id)}
                  className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200"
                  style={getStageAccentStyle(stage.slug)}
                  aria-expanded={!isCollapsed}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-neutral-900 truncate">
                          {displayStageName(stage.name)}
                        </span>
                        <InfoPopover
                          title={displayStageName(stage.name)}
                          bullets={stageHelp.bullets}
                          tip={stageHelp.tip}
                        />
                      </div>
                      <div className="text-xs text-neutral-500">{sectionLeads.length} lead{sectionLeads.length === 1 ? '' : 's'}</div>
                    </div>
                    <span
                      className="text-neutral-500"
                      style={{
                        transition: prefersReducedMotion ? 'none' : 'transform 0.2s ease',
                        transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                      }}
                      aria-hidden
                    >
                      ▶
                    </span>
                  </div>
                </button>

                {!isCollapsed ? (
                  <div className="mt-2 space-y-2">
                    {sectionLeads.length === 0 ? (
                      <EmptyState title="No hay leads en esta etapa." variant="dashed" />
                    ) : (
                      sectionLeads.map((lead) => {
                        const isHighlight = highlightLeadId === lead.id
                        return (
                          <LeadCardMobile
                            key={lead.id}
                            lead={lead}
                            stages={stages}
                            stageName={stage.name}
                            stageSlug={stage.slug}
                            nextAppointment={nextAppointmentByLeadId[lead.id] ?? null}
                            schedulingGuidance={schedulingGuidanceByLeadId[lead.id]}
                            isHighlight={isHighlight}
                            onRowClick={onRowClick}
                            onMoveStage={onMoveStage}
                            onToast={onToast}
                            onUpdated={onUpdated}
                            onSchedule={onSchedule}
                            onEditAppointment={onEditAppointment}
                            variant="table"
                          />
                        )
                      })
                    )}
                  </div>
                ) : null}
              </Fragment>
            )
          })
        : leads.map((lead) => {
            const stage = stageById.get(lead.stage_id)
            return (
            <LeadCardMobile
              key={lead.id}
              lead={lead}
              stages={stages}
              stageName={stage?.name}
              stageSlug={stage?.slug}
              nextAppointment={nextAppointmentByLeadId[lead.id] ?? null}
              schedulingGuidance={schedulingGuidanceByLeadId[lead.id]}
              isHighlight={highlightLeadId === lead.id}
              onRowClick={onRowClick}
              onMoveStage={onMoveStage}
              onToast={onToast}
              onUpdated={onUpdated}
              onSchedule={onSchedule}
              onEditAppointment={onEditAppointment}
              variant="table"
            />
            )
          })}
    </div>
  )

  // =====================
  // Desktop: Tabla
  // =====================
  const DesktopTable = (
    <div className="hidden md:block overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed text-sm">
          <thead className="sticky top-0 z-10 bg-white/90 backdrop-blur border-b border-neutral-200">
            <HeaderRow />
          </thead>
          <tbody>
            {showGrouped
              ? groupedSections.map(({ stage, leads: sectionLeads }, sectionIndex) => {
                  const isCollapsed =
                    collapsedStages[stage.id] ?? (collapseEmptyByDefault && sectionLeads.length === 0)
                  const stageHelp = getStageHelp(stage.slug ?? stage.name)
                  const isFirst = sectionIndex === 0
                  return (
                    <Fragment key={stage.id}>
                      {!isFirst ? (
                        <tr aria-hidden="true">
                          <td colSpan={5} className="h-3 bg-neutral-50" />
                        </tr>
                      ) : null}

                      <tr
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleStage(stage.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            toggleStage(stage.id)
                          }
                        }}
                        className="cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200 focus-visible:ring-inset"
                        style={getStageAccentStyle(stage.slug)}
                        aria-expanded={!isCollapsed}
                      >
                        <td colSpan={5} className="border-y border-neutral-200 bg-neutral-50 hover:bg-neutral-100">
                          <div className="flex items-center justify-between gap-3 px-4 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className="inline-flex p-0.5 -m-0.5 text-neutral-500"
                                style={{
                                  transition: prefersReducedMotion ? 'none' : 'transform 0.2s ease',
                                  transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                                }}
                                aria-hidden
                              >
                                ▶
                              </span>
                              <span className="font-semibold text-neutral-900 truncate">{displayStageName(stage.name)}</span>
                              <InfoPopover
                                title={displayStageName(stage.name)}
                                bullets={stageHelp.bullets}
                                tip={stageHelp.tip}
                              />
                              <span className="text-xs text-neutral-500">({sectionLeads.length})</span>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {!isCollapsed ? (
                        sectionLeads.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-4 py-6">
                              <EmptyState title="No hay leads en esta etapa." variant="plain" />
                            </td>
                          </tr>
                        ) : (
                          sectionLeads.map((lead) => {
                            const isHighlight = highlightLeadId === lead.id
                            return (
                              <LeadRowDesktop
                                key={lead.id}
                                lead={lead}
                                stages={stages}
                                stageName={stage.name}
                                stageSlug={stage.slug}
                                nextAppointment={nextAppointmentByLeadId[lead.id] ?? null}
                                schedulingGuidance={schedulingGuidanceByLeadId[lead.id]}
                                isHighlight={isHighlight}
                                onRowClick={onRowClick}
                                onMoveStage={onMoveStage}
                                onToast={onToast}
                                onUpdated={onUpdated}
                                onSchedule={onSchedule}
                                onEditAppointment={onEditAppointment}
                              />
                            )
                          })
                        )
                      ) : null}
                    </Fragment>
                  )
                })
              : leads.map((lead) => {
                  const stage = stageById.get(lead.stage_id)
                  return (
                  <LeadRowDesktop
                    key={lead.id}
                    lead={lead}
                    stages={stages}
                    stageName={stage?.name}
                    stageSlug={stage?.slug}
                    nextAppointment={nextAppointmentByLeadId[lead.id] ?? null}
                    schedulingGuidance={schedulingGuidanceByLeadId[lead.id]}
                    isHighlight={highlightLeadId === lead.id}
                    onRowClick={onRowClick}
                    onMoveStage={onMoveStage}
                    onToast={onToast}
                    onUpdated={onUpdated}
                    onSchedule={onSchedule}
                    onEditAppointment={onEditAppointment}
                  />
                  )
                })}
          </tbody>
        </table>
      </div>
    </div>
  )

  return (
    <div>
      {MobileCards}
      {DesktopTable}
    </div>
  )
}
