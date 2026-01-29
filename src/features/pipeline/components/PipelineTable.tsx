import { useState, useEffect, useRef, Fragment, forwardRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Lead } from '../pipeline.api'
import type { ProximaLabel } from '../utils/proximaLabel'
import { getStageAccentStyle, displayStageName, getStageTagClasses } from '../../../shared/utils/stageStyles'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'
import { calendarApi } from '../../calendar/api/calendar.api'
import type { CalendarEvent } from '../../calendar/types/calendar.types'
import { getTypePillClass, getTypeLabel, formatNextAppointmentShort } from '../../calendar/utils/pillStyles'

type Stage = { id: string; name: string; position: number }

function phoneDigits(phone: string): string {
  return (phone || '').replace(/\D/g, '')
}

/** Número para wa.me en MX: 10 dígitos -> "52"+digits; 12–13 con 52 -> as-is; <10 -> "" */
function normalizeWhatsAppNumber(digits: string): string {
  if (digits.length < 10) return ''
  if (digits.length === 10) return '52' + digits
  if (digits.startsWith('52') && digits.length >= 12 && digits.length <= 13) return digits
  return ''
}

/** Estado de próxima acción para el dot: overdue | today | soon | ok | none */
export function getNextStatus(next_follow_up_at: string | null | undefined): 'overdue' | 'today' | 'soon' | 'ok' | 'none' {
  if (!next_follow_up_at) return 'none'
  try {
    const d = new Date(next_follow_up_at)
    const y = d.getFullYear()
    const m = d.getMonth()
    const day = d.getDate()
    const followUpDate = new Date(y, m, day).getTime()
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const oneDay = 24 * 60 * 60 * 1000
    if (followUpDate < todayStart) return 'overdue'
    if (followUpDate === todayStart) return 'today'
    const daysDiff = Math.round((followUpDate - todayStart) / oneDay)
    if (daysDiff >= 1 && daysDiff <= 2) return 'soon'
    return 'ok'
  } catch {
    return 'none'
  }
}

function isClosedStage(stageName: string | undefined): boolean {
  if (!stageName) return false
  return stageName.toLowerCase().includes('cerrado')
}

export type GroupedSection = { stage: Stage; leads: Lead[] }

type PipelineTableProps = {
  leads: Lead[]
  stages: Stage[]
  groupByStage?: boolean
  groupedSections?: GroupedSection[]
  collapsedStages?: Record<string, boolean>
  onCollapsedStagesChange?: (next: Record<string, boolean>) => void
  highlightLeadId?: string | null
  getProximaLabel: (stageName: string, next_follow_up_at: string | null | undefined) => ProximaLabel
  onRowClick: (lead: Lead) => void
  onMoveStage?: (leadId: string, toStageId: string) => Promise<void>
}

/** Estructura: Lead, Etapa, Progreso, Contacto, Acción. */
const NUM_COLS = 5

const TH_BASE = 'px-4 py-1.5 text-[11px] uppercase tracking-wide text-neutral-500'
const TD_BASE = 'py-2 px-4 align-middle border-b border-dashed border-neutral-200/60'

function buildHeaderRow() {
  return (
    <tr>
      <th className={`${TH_BASE} text-left`}>Lead</th>
      <th className={`${TH_BASE} text-left`}>Etapa</th>
      <th className={`${TH_BASE} text-left`}>Progreso</th>
      <th className={`${TH_BASE} text-left`}>Contacto</th>
      <th className={`${TH_BASE} text-right`}>Acción</th>
    </tr>
  )
}

/** Progreso visual: ● etapa actual, ○ resto (orden por position). */
function ProgressDots({ stages, currentStageId }: { stages: Stage[]; currentStageId: string | null }) {
  const sorted = [...stages].sort((a, b) => a.position - b.position)
  if (!sorted.length) return <span className="text-neutral-300">—</span>
  return (
    <span className="inline-flex items-center gap-0.5 text-neutral-400" aria-hidden>
      {sorted.map((s) => (
        <span key={s.id} className={s.id === currentStageId ? 'text-neutral-700' : ''} title={displayStageName(s.name)}>
          {s.id === currentStageId ? '●' : '○'}
        </span>
      ))}
    </span>
  )
}

type RowRenderProps = {
  lead: Lead
  stageName: string | undefined
  stages: Stage[]
  isHighlight?: boolean
  nextEvent: CalendarEvent | null
  getProximaLabel: (stageName: string, next_follow_up_at: string | null | undefined) => ProximaLabel
  onRowClick: (lead: Lead) => void
  onMoveStage?: (leadId: string, toStageId: string) => Promise<void>
}

const PipelineTableRow = forwardRef<HTMLTableRowElement, RowRenderProps>(function PipelineTableRow(
  { lead, stageName, stages, isHighlight, nextEvent, getProximaLabel: _getProximaLabel, onRowClick, onMoveStage },
  ref
) {
  const navigate = useNavigate()
  const [moveMenuOpen, setMoveMenuOpen] = useState(false)
  const moveMenuRef = useRef<HTMLDivElement>(null)
  const moveTriggerRef = useRef<HTMLButtonElement>(null)

  const closed = isClosedStage(stageName)
  const digits = phoneDigits(lead.phone ?? '')
  const waNumber = normalizeWhatsAppNumber(digits)
  const telHref = lead.phone?.trim() ? `tel:${lead.phone.replace(/\s/g, '')}` : null

  const handleRowClick = () => {
    navigate(`/leads/${lead.id}`)
    onRowClick(lead)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleRowClick()
    }
  }

  const stopProp = (e: React.MouseEvent | React.KeyboardEvent) => e.stopPropagation()

  // Cerrar menú Mover: Escape y click fuera
  useEffect(() => {
    if (!moveMenuOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoveMenuOpen(false)
    }
    const handleClickOutside = (e: MouseEvent) => {
      const el = moveMenuRef.current
      const trigger = moveTriggerRef.current
      if (el && !el.contains(e.target as Node) && trigger && !trigger.contains(e.target as Node)) setMoveMenuOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [moveMenuOpen])

  return (
    <tr
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={handleKeyDown}
      className={`group select-none cursor-pointer bg-white transition-colors hover:bg-neutral-50 focus-within:bg-neutral-50 focus-within:ring-2 focus-within:ring-neutral-200 focus-within:ring-inset focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200 focus-visible:ring-inset ${closed ? 'opacity-70' : ''} ${isHighlight ? 'ring-2 ring-primary/40 ring-inset bg-primary/5' : ''}`}
      style={getStageAccentStyle(stageName)}
    >
      {/* Lead */}
      <td className={`${TD_BASE}`}>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900 leading-tight">
            {closed ? <span className="text-neutral-700">{lead.full_name}</span> : lead.full_name}
          </span>
          {nextEvent && (
            <span className="text-xs text-neutral-500 truncate flex items-center gap-1.5 min-w-0">
              <span className="shrink-0">Próxima cita:</span>
              <span className="truncate tabular-nums">{formatNextAppointmentShort(nextEvent.starts_at)}</span>
              <span className="shrink-0">·</span>
              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[11px] font-medium ${getTypePillClass(nextEvent.type)}`}>
                {getTypeLabel(nextEvent.type)}
              </span>
            </span>
          )}
        </div>
      </td>
      {/* Etapa */}
      <td className={`${TD_BASE} max-w-[120px]`}>
        {stageName ? (
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ring-black/5 truncate max-w-full ${getStageTagClasses(stageName)}`}
            title={displayStageName(stageName)}
          >
            {displayStageName(stageName)}
          </span>
        ) : (
          <span className="text-sm text-neutral-400">—</span>
        )}
      </td>
      {/* Progreso */}
      <td className={`${TD_BASE}`}>
        <ProgressDots stages={stages} currentStageId={lead.stage_id} />
      </td>
      {/* Contacto */}
      <td className={`${TD_BASE} max-w-[200px]`}>
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0 flex-1 space-y-0.5">
            {lead.phone?.trim() ? (
              telHref ? (
                <a href={telHref} className="block truncate text-sm text-neutral-700 hover:text-neutral-900 hover:underline" onClick={stopProp} onKeyDown={stopProp}>
                  {lead.phone}
                </a>
              ) : (
                <span className="block truncate text-sm text-neutral-700">{lead.phone}</span>
              )
            ) : (
              <span className="text-sm text-neutral-400">—</span>
            )}
            {lead.email?.trim() ? (
              <a href={`mailto:${lead.email}`} className="block truncate text-xs text-neutral-500 hover:text-neutral-700 hover:underline" onClick={stopProp} onKeyDown={stopProp}>
                {lead.email}
              </a>
            ) : null}
          </div>
          <span className="w-[52px] shrink-0 flex justify-end gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100" onClick={stopProp} onKeyDown={stopProp}>
            {waNumber ? (
              <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700" title="WhatsApp" onClick={stopProp}>
                <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
              </a>
            ) : null}
            {telHref ? (
              <a href={telHref} className="inline-flex rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700" title="Llamar" onClick={stopProp}>
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" /></svg>
              </a>
            ) : null}
          </span>
        </div>
      </td>
      {/* Acción: Mover etapa ▾ */}
      <td className={`${TD_BASE} text-right`} onClick={stopProp} onKeyDown={stopProp}>
        {onMoveStage && stages.length > 0 ? (
          <div className="relative inline-flex justify-end opacity-100 sm:opacity-70 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity" ref={moveMenuRef}>
            <button
              type="button"
              ref={moveTriggerRef}
              aria-label="Mover etapa"
              aria-haspopup="menu"
              aria-expanded={moveMenuOpen}
              onClick={(e) => {
                e.stopPropagation()
                setMoveMenuOpen((o) => !o)
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300"
            >
              Mover etapa <span className="text-neutral-400" aria-hidden>▾</span>
            </button>
            {moveMenuOpen && (
              <div
                className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-md border border-neutral-200 bg-white py-1 shadow-lg"
                role="menu"
              >
                {[...stages]
                  .sort((a, b) => a.position - b.position)
                  .map((s) => {
                    const isCurrent = s.id === lead.stage_id
                    return (
                      <button
                        key={s.id}
                        type="button"
                        role="menuitem"
                        disabled={isCurrent}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!isCurrent) void onMoveStage(lead.id, s.id)
                          setMoveMenuOpen(false)
                        }}
                        className={`w-full px-3 py-1.5 text-left text-sm ${isCurrent ? 'bg-neutral-50 text-neutral-400 cursor-default' : 'hover:bg-neutral-50 text-neutral-800'}`}
                      >
                        {displayStageName(s.name)}{isCurrent ? ' ✓' : ''}
                      </button>
                    )
                  })}
              </div>
            )}
          </div>
        ) : (
          <span className="text-sm text-neutral-400">—</span>
        )}
      </td>
    </tr>
  )
})

/**
 * Vista tabla enterprise del Pipeline.
 * Modo plano: una tabla con columna Etapa.
 * Modo agrupado: secciones por etapa (header sticky + tabla sin columna Etapa).
 */
export function PipelineTable({
  leads,
  stages,
  groupByStage = false,
  groupedSections = [],
  collapsedStages: controlledCollapsed,
  onCollapsedStagesChange,
  highlightLeadId,
  getProximaLabel,
  onRowClick,
  onMoveStage,
}: PipelineTableProps) {
  const showGrouped = groupByStage && groupedSections.length > 0
  const prefersReducedMotion = useReducedMotion()
  const [internalCollapsed, setInternalCollapsed] = useState<Record<string, boolean>>({})
  const highlightRowRef = useRef<HTMLTableRowElement | null>(null)
  const [nextEventByLeadId, setNextEventByLeadId] = useState<Record<string, CalendarEvent | null>>({})

  const visibleLeadIds = useMemo(
    () => (showGrouped ? groupedSections.flatMap((s) => s.leads.map((l) => l.id)) : leads.map((l) => l.id)),
    [showGrouped, groupedSections, leads]
  )

  useEffect(() => {
    if (visibleLeadIds.length === 0) return
    let cancelled = false
    const t = setTimeout(() => {
      calendarApi
        .getNextScheduledEventByLeadIds(visibleLeadIds)
        .then((map) => {
          if (!cancelled) setNextEventByLeadId(map)
        })
        .catch((err) => {
          if (!cancelled) console.warn('[pipeline] getNextScheduledEventByLeadIds:', err)
        })
    }, 280)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [visibleLeadIds])

  const numCols = NUM_COLS

  const isControlled = controlledCollapsed != null && onCollapsedStagesChange != null
  const collapsedStages = isControlled ? controlledCollapsed : internalCollapsed
  const setCollapsedStages = isControlled ? onCollapsedStagesChange : setInternalCollapsed

  // Estado inicial (solo modo no controlado): etapas con 0 leads colapsadas, con >=1 lead expandidas
  useEffect(() => {
    if (isControlled || !showGrouped || groupedSections.length === 0) return
    setInternalCollapsed((prev) => {
      let next = prev
      for (const { stage, leads: sectionLeads } of groupedSections) {
        if (stage.id in next) continue
        next = { ...next, [stage.id]: sectionLeads.length === 0 }
      }
      return next
    })
  }, [isControlled, showGrouped, groupedSections])

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

  if (showGrouped) {
    let resultsSeparatorInserted = false
    return (
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="table-fixed w-full text-sm border-separate border-spacing-0">
            <thead className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50">
              {buildHeaderRow()}
            </thead>
            <tbody>
              {groupedSections.map(({ stage, leads: sectionLeads }, sectionIndex) => {
                const isCollapsed = collapsedStages[stage.id] ?? sectionLeads.length === 0
                const insertResultsSeparator = isClosedStage(stage.name) && !resultsSeparatorInserted
                if (insertResultsSeparator) resultsSeparatorInserted = true
                const isFirstSection = sectionIndex === 0

                return (
                  <Fragment key={stage.id}>
                    {insertResultsSeparator && (
                      <tr>
                        <td colSpan={numCols} className="py-2 border-t border-neutral-200 text-center text-[11px] uppercase tracking-wide text-neutral-400">
                          Resultados
                        </td>
                      </tr>
                    )}
                    {!isFirstSection && (
                      <tr aria-hidden="true">
                        <td colSpan={numCols} className="h-3 bg-neutral-50" />
                      </tr>
                    )}
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
                      className="cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-200 focus:ring-inset"
                      style={getStageAccentStyle(stage.name)}
                      aria-expanded={!isCollapsed}
                    >
                      <td
                        colSpan={numCols}
                        className="sticky top-10 z-[9] border-y border-neutral-200 bg-neutral-100 hover:bg-neutral-200/60"
                      >
                        <div className="flex items-center gap-2 px-4 py-2 text-left text-sm font-semibold text-neutral-800">
                          <span className="w-1 shrink-0 self-stretch min-h-[2rem] bg-neutral-300 rounded-r" aria-hidden="true" />
                          <span
                            className="inline-flex p-0.5 -m-0.5 text-neutral-400 shrink-0"
                            style={{
                              transition: prefersReducedMotion ? 'none' : 'transform 0.2s ease',
                              transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                            }}
                            aria-hidden
                          >
                            ▶
                          </span>
                          <span>{displayStageName(stage.name)}</span>
                          <span className="inline-flex items-center justify-center rounded-full bg-neutral-200/80 px-2 py-0.5 text-[11px] font-medium text-neutral-600 tabular-nums min-w-[1.25rem]">
                            {sectionLeads.length}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {!isCollapsed &&
                      sectionLeads.length > 0 &&
                      sectionLeads.map((lead) => (
                        <PipelineTableRow
                          key={lead.id}
                          ref={lead.id === highlightLeadId ? highlightRowRef : undefined}
                          lead={lead}
                          stageName={stage.name}
                          stages={stages}
                          isHighlight={lead.id === highlightLeadId}
                          nextEvent={nextEventByLeadId[lead.id] ?? null}
                          getProximaLabel={getProximaLabel}
                          onRowClick={onRowClick}
                          onMoveStage={onMoveStage}
                        />
                      ))}
                    {!isCollapsed && sectionLeads.length > 0 && (
                      <tr aria-hidden="true">
                        <td colSpan={numCols} className="h-2 bg-transparent" />
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="table-fixed w-full text-sm border-separate border-spacing-0">
          <thead className="sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50">
            {buildHeaderRow()}
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td colSpan={numCols} className="px-4 py-12 text-center text-sm text-muted">
                  No se encontraron leads con los filtros aplicados
                </td>
              </tr>
            ) : (
              leads.map((lead) => {
                const stageName = stages.find((s) => s.id === lead.stage_id)?.name
                return (
                  <PipelineTableRow
                    key={lead.id}
                    ref={lead.id === highlightLeadId ? highlightRowRef : undefined}
                    lead={lead}
                    stageName={stageName}
                    stages={stages}
                    isHighlight={lead.id === highlightLeadId}
                    nextEvent={nextEventByLeadId[lead.id] ?? null}
                    getProximaLabel={getProximaLabel}
                    onRowClick={onRowClick}
                    onMoveStage={onMoveStage}
                  />
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
