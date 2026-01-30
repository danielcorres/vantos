import { useState, useEffect, useRef, Fragment, forwardRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import type { Lead } from '../pipeline.api'
import type { ProximaLabel } from '../utils/proximaLabel'
import { getStageAccentStyle, displayStageName } from '../../../shared/utils/stageStyles'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'
import { calendarApi } from '../../calendar/api/calendar.api'
import type { CalendarEvent } from '../../calendar/types/calendar.types'
import { IconUser, IconPhone, IconMail, IconCopy } from '../../../app/layout/icons'

type Stage = { id: string; name: string; position: number }

const MENU_HEIGHT_ESTIMATE = 260
const MENU_MIN_WIDTH = 220
const STAGE_MOVE_MENU_Z = 80

/** Menú "Mover etapa" renderizado en portal al body para evitar recorte por overflow. */
function StageMoveMenu({
  open,
  onClose,
  anchorRect,
  stages,
  lead,
  onMoveStage,
  menuRef,
}: {
  open: boolean
  onClose: () => void
  anchorRect: DOMRect | null
  stages: Stage[]
  lead: Lead
  onMoveStage: (leadId: string, toStageId: string) => Promise<void>
  menuRef: React.RefObject<HTMLDivElement | null>
}) {
  if (!open || !anchorRect) return null
  const spaceBelow = typeof window !== 'undefined' ? window.innerHeight - anchorRect.bottom : 0
  const openUpward = spaceBelow < MENU_HEIGHT_ESTIMATE
  const left = typeof window !== 'undefined'
    ? Math.max(8, Math.min(anchorRect.left, window.innerWidth - MENU_MIN_WIDTH - 8))
    : anchorRect.left
  const style: React.CSSProperties = {
    position: 'fixed',
    left,
    minWidth: MENU_MIN_WIDTH,
    zIndex: STAGE_MOVE_MENU_Z,
    ...(openUpward
      ? { bottom: typeof window !== 'undefined' ? window.innerHeight - anchorRect.top + 4 : anchorRect.top - 4 }
      : { top: anchorRect.bottom + 4 }),
  }
  const sortedStages = [...stages].sort((a, b) => a.position - b.position)
  const content = (
    <div
      ref={menuRef}
      role="menu"
      className="rounded-md border border-neutral-200 bg-white py-1 shadow-lg"
      style={style}
    >
      {sortedStages.map((s) => {
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
              onClose()
            }}
            className={`w-full px-3 py-1.5 text-left text-sm ${isCurrent ? 'bg-neutral-50 text-neutral-400 cursor-default' : 'hover:bg-neutral-50 text-neutral-800'}`}
          >
            {displayStageName(s.name)}{isCurrent ? ' ✓' : ''}
          </button>
        )
      })}
    </div>
  )
  return createPortal(content, document.body)
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

/** Clasificación de fuente (case-insensitive) para pill. */
function getSourcePillLabel(source: string | null | undefined): string {
  const s = (source ?? '').trim().toLowerCase()
  if (s.includes('refer')) return 'Referido'
  if (s.includes('mercado') || s.includes('natural')) return 'Mercado natural'
  if (s.includes('frio') || s.includes('frío') || s.includes('cold') || s.includes('social')) return 'Frío'
  return s ? 'Otros' : '—'
}

function getSourcePillClass(source: string | null | undefined): string {
  const label = getSourcePillLabel(source)
  const base = 'text-xs rounded-full border border-black/5 px-2 py-0.5 font-medium'
  switch (label) {
    case 'Referido':
      return `${base} bg-emerald-100 text-emerald-800 border-emerald-200/60`
    case 'Mercado natural':
      return `${base} bg-sky-100 text-sky-800 border-sky-200/60`
    case 'Frío':
      return `${base} bg-neutral-200/80 text-neutral-700 border-neutral-300/60`
    case 'Otros':
      return `${base} bg-neutral-100 text-neutral-600 border-neutral-200/60`
    default:
      return `${base} bg-neutral-100/80 text-neutral-500`
  }
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
  onToast?: (message: string) => void
}

/** Estructura: Nombre, Teléfono, Email, Progreso, Fuente, Acción. */
const NUM_COLS = 6

const TH_BASE = 'px-4 py-1.5 text-[11px] uppercase tracking-wide text-neutral-500'
const TD_BASE = 'py-2 px-4 align-middle border-b border-dashed border-neutral-200/60'

function buildHeaderRow() {
  return (
    <tr>
      <th className={`${TH_BASE} text-left`}>Nombre</th>
      <th className={`${TH_BASE} text-left hidden md:table-cell`}>Teléfono</th>
      <th className={`${TH_BASE} text-left hidden md:table-cell`}>Email</th>
      <th className={`${TH_BASE} text-left`}>Progreso</th>
      <th className={`${TH_BASE} text-left hidden md:table-cell`}>Fuente</th>
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
  onToast?: (message: string) => void
}

const PipelineTableRow = forwardRef<HTMLTableRowElement, RowRenderProps>(function PipelineTableRow(
  { lead, stageName, stages, isHighlight, nextEvent: _nextEvent, getProximaLabel: _getProximaLabel, onRowClick, onMoveStage, onToast },
  ref
) {
  const navigate = useNavigate()
  const [moveMenuOpen, setMoveMenuOpen] = useState(false)
  const [moveMenuAnchorRect, setMoveMenuAnchorRect] = useState<DOMRect | null>(null)
  const moveMenuRef = useRef<HTMLDivElement>(null)
  const moveTriggerRef = useRef<HTMLButtonElement>(null)

  const closed = isClosedStage(stageName)
  const phone = lead.phone?.trim() ?? ''
  const email = lead.email?.trim() ?? ''

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

  const handleCopy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      onToast?.(label === 'phone' ? 'Teléfono copiado' : 'Email copiado')
    })
  }

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
      {/* Nombre — en móvil incluye teléfono, email y fuente apilados */}
      <td className={TD_BASE}>
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <IconUser className="w-4 h-4 shrink-0 text-neutral-400" />
            <span className="min-w-0 truncate text-sm font-medium text-neutral-900">
              {closed ? <span className="text-neutral-700">{lead.full_name}</span> : lead.full_name}
            </span>
          </div>
          {/* Móvil: teléfono, email, fuente (ocultos en desktop donde hay columnas propias) */}
          <div className="flex flex-col gap-1 md:hidden">
            {phone ? (
              <div className="flex items-center gap-1.5 min-w-0" onClick={stopProp} onKeyDown={stopProp}>
                <IconPhone className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
                <span className="truncate text-xs text-neutral-700 min-w-0">{phone}</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); handleCopy(phone, 'phone') }} className="shrink-0 p-0.5 rounded text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700" aria-label="Copiar teléfono">
                  <IconCopy className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : null}
            {email ? (
              <div className="flex items-center gap-1.5 min-w-0" onClick={stopProp} onKeyDown={stopProp}>
                <IconMail className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
                <span className="truncate text-xs text-neutral-700 min-w-0">{email}</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); handleCopy(email, 'email') }} className="shrink-0 p-0.5 rounded text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700" aria-label="Copiar email">
                  <IconCopy className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : null}
            {getSourcePillLabel(lead.source) !== '—' && (
              <span className={getSourcePillClass(lead.source)}>{getSourcePillLabel(lead.source)}</span>
            )}
          </div>
        </div>
      </td>
      {/* Teléfono — solo desktop */}
      <td className={`${TD_BASE} hidden md:table-cell max-w-[160px]`} onClick={stopProp} onKeyDown={stopProp}>
        <div className="flex items-center gap-2 min-w-0">
          <IconPhone className="w-4 h-4 shrink-0 text-neutral-400" />
          {phone ? (
            <>
              <span className="truncate text-sm text-neutral-800 min-w-0">{phone}</span>
              <button type="button" onClick={() => handleCopy(phone, 'phone')} className="shrink-0 p-1 rounded text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity" aria-label="Copiar teléfono">
                <IconCopy className="w-4 h-4" />
              </button>
            </>
          ) : (
            <span className="text-sm text-neutral-400">—</span>
          )}
        </div>
      </td>
      {/* Email — solo desktop */}
      <td className={`${TD_BASE} hidden md:table-cell max-w-[200px]`} onClick={stopProp} onKeyDown={stopProp}>
        <div className="flex items-center gap-2 min-w-0">
          <IconMail className="w-4 h-4 shrink-0 text-neutral-400" />
          {email ? (
            <>
              <span className="truncate text-sm text-neutral-800 min-w-0">{email}</span>
              <button type="button" onClick={() => handleCopy(email, 'email')} className="shrink-0 p-1 rounded text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity" aria-label="Copiar email">
                <IconCopy className="w-4 h-4" />
              </button>
            </>
          ) : (
            <span className="text-sm text-neutral-400">—</span>
          )}
        </div>
      </td>
      {/* Progreso */}
      <td className={TD_BASE}>
        <ProgressDots stages={stages} currentStageId={lead.stage_id} />
      </td>
      {/* Fuente — solo desktop */}
      <td className={`${TD_BASE} hidden md:table-cell`} onClick={stopProp} onKeyDown={stopProp}>
        {getSourcePillLabel(lead.source) !== '—' ? (
          <span className={getSourcePillClass(lead.source)}>{getSourcePillLabel(lead.source)}</span>
        ) : (
          <span className="text-sm text-neutral-400">—</span>
        )}
      </td>
      {/* Acción: Mover etapa ▾ — menú en portal para no recortarse */}
      <td className={`${TD_BASE} text-right`} onClick={stopProp} onKeyDown={stopProp}>
        {onMoveStage && stages.length > 0 ? (
          <div className="relative inline-flex justify-end opacity-100 sm:opacity-70 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
            <button
              type="button"
              ref={moveTriggerRef}
              aria-label="Mover etapa"
              aria-haspopup="menu"
              aria-expanded={moveMenuOpen}
              onClick={(e) => {
                e.stopPropagation()
                const rect = moveTriggerRef.current?.getBoundingClientRect() ?? null
                setMoveMenuAnchorRect(rect)
                setMoveMenuOpen((o) => !o)
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300"
            >
              Mover etapa <span className="text-neutral-400" aria-hidden>▾</span>
            </button>
            <StageMoveMenu
              open={moveMenuOpen}
              onClose={() => {
                setMoveMenuOpen(false)
                setMoveMenuAnchorRect(null)
              }}
              anchorRect={moveMenuAnchorRect}
              stages={stages}
              lead={lead}
              onMoveStage={onMoveStage}
              menuRef={moveMenuRef}
            />
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
  onToast,
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
                          onToast={onToast}
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
                    onToast={onToast}
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
