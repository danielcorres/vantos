import { useState, useEffect, useRef, Fragment, forwardRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Lead } from '../pipeline.api'
import type { ProximaLabel } from '../utils/proximaLabel'
import { getStageAccentStyle, displayStageName } from '../../../shared/utils/stageStyles'
import { getSourceTag } from '../../../shared/utils/sourceTag'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'

type Stage = { id: string; name: string; position: number }

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

function formatCreatedShort(dateString: string | null | undefined): string | null {
  if (!dateString) return null
  try {
    const d = new Date(dateString)
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    return `${d.getDate()} ${months[d.getMonth()]}`
  } catch {
    return null
  }
}

function daysAgo(dateString: string | null | undefined): number {
  if (!dateString) return 0
  try {
    const now = Date.now()
    const past = new Date(dateString).getTime()
    return Math.max(0, Math.floor((now - past) / (24 * 60 * 60 * 1000)))
  } catch {
    return 0
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
}

const NUM_COLS = 5

const TH_BASE = 'px-4 py-2 text-[11px] uppercase tracking-wide text-neutral-500'
/** Celdas de fila lead: borde inferior punteado tenue en todas las columnas */
const TD_BASE = 'py-2.5 px-4 align-middle border-b border-dashed border-neutral-200/60'
const HEADER_ROW = (
  <tr>
    <th className={`${TH_BASE} text-left`}>Lead</th>
    <th className={`${TH_BASE} text-left`}>Teléfono</th>
    <th className={`${TH_BASE} text-left`}>Email</th>
    <th className={`${TH_BASE} text-left`}>Fuente</th>
    <th className={`${TH_BASE} text-right`}>Creado</th>
  </tr>
)

type RowRenderProps = {
  lead: Lead
  stageName: string | undefined
  isHighlight?: boolean
  getProximaLabel: (stageName: string, next_follow_up_at: string | null | undefined) => ProximaLabel
  onRowClick: (lead: Lead) => void
}

const PipelineTableRow = forwardRef<HTMLTableRowElement, RowRenderProps>(function PipelineTableRow(
  { lead, stageName, isHighlight, getProximaLabel: _getProximaLabel, onRowClick },
  ref
) {
  const navigate = useNavigate()
  const closed = isClosedStage(stageName)
  const createdShort = formatCreatedShort(lead.created_at)
  const days = daysAgo(lead.created_at)
  const sourceTagClass = getSourceTag(lead.source)

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
      <td className={`${TD_BASE}`}>
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-neutral-900 leading-tight">
            {closed ? <span className="text-neutral-700">{lead.full_name}</span> : lead.full_name}
          </span>
          <span className="shrink-0 text-neutral-300 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>›</span>
        </div>
      </td>
      <td className={`${TD_BASE} max-w-[140px]`}>
        {lead.phone?.trim() ? (
          <a
            href={`tel:${lead.phone.replace(/\s/g, '')}`}
            className="block text-sm text-neutral-700 truncate hover:text-neutral-900 hover:underline"
            onClick={stopProp}
            onKeyDown={stopProp}
          >
            {lead.phone}
          </a>
        ) : (
          <span className="text-sm text-neutral-400">—</span>
        )}
      </td>
      <td className={`${TD_BASE} max-w-[180px]`}>
        {lead.email?.trim() ? (
          <a
            href={`mailto:${lead.email}`}
            className="block text-sm text-neutral-700 truncate hover:text-neutral-900 hover:underline"
            onClick={stopProp}
            onKeyDown={stopProp}
          >
            {lead.email}
          </a>
        ) : (
          <span className="text-sm text-neutral-400">—</span>
        )}
      </td>
      <td className={`${TD_BASE} max-w-[120px]`}>
        {lead.source?.trim() ? (
          <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ring-black/5 truncate max-w-full ${sourceTagClass}`}>
            {lead.source}
          </span>
        ) : (
          <span className="text-sm text-neutral-400">—</span>
        )}
      </td>
      <td className={`${TD_BASE} text-right`}>
        {createdShort ? (
          <div>
            <div className="text-xs text-neutral-700 tabular-nums">{createdShort}</div>
            <div className="text-[11px] text-neutral-500">
              {days === 0 ? 'hoy' : days === 1 ? 'hace 1 día' : `hace ${days} días`}
            </div>
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
}: PipelineTableProps) {
  const showGrouped = groupByStage && groupedSections.length > 0
  const prefersReducedMotion = useReducedMotion()
  const [internalCollapsed, setInternalCollapsed] = useState<Record<string, boolean>>({})
  const highlightRowRef = useRef<HTMLTableRowElement | null>(null)

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
            <thead className="border-b border-neutral-200 bg-neutral-50">
              {HEADER_ROW}
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
                        <td colSpan={NUM_COLS} className="py-2 border-t border-neutral-200 text-center text-[11px] uppercase tracking-wide text-neutral-400">
                          Resultados
                        </td>
                      </tr>
                    )}
                    {!isFirstSection && (
                      <tr aria-hidden="true">
                        <td colSpan={NUM_COLS} className="h-3 bg-neutral-50" />
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
                        colSpan={NUM_COLS}
                        className="border-y border-neutral-200 bg-neutral-100 hover:bg-neutral-200/60"
                      >
                        <div className="flex items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-neutral-800">
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
                          isHighlight={lead.id === highlightLeadId}
                          getProximaLabel={getProximaLabel}
                          onRowClick={onRowClick}
                        />
                      ))}
                    {!isCollapsed && sectionLeads.length > 0 && (
                      <tr aria-hidden="true">
                        <td colSpan={NUM_COLS} className="h-2 bg-transparent" />
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
          <thead className="border-b border-neutral-200 bg-neutral-50">
            {HEADER_ROW}
          </thead>
          <tbody>
            {leads.length === 0 ? (
              <tr>
                <td colSpan={NUM_COLS} className="px-4 py-12 text-center text-sm text-muted">
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
                    isHighlight={lead.id === highlightLeadId}
                    getProximaLabel={getProximaLabel}
                    onRowClick={onRowClick}
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
