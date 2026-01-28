import { useState, useEffect, Fragment } from 'react'
import type { Lead } from '../pipeline.api'
import type { ProximaLabel } from '../utils/proximaLabel'
import { getStageTagClasses, getStageAccentStyle, displayStageName } from '../../../shared/utils/stageStyles'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'

type Stage = { id: string; name: string; position: number }

function phoneDigits(phone: string): string {
  return (phone || '').replace(/\D/g, '')
}

function normalizeWhatsAppNumber(digits: string): string {
  if (digits.length < 10) return ''
  if (digits.length === 10) return '52' + digits
  if (digits.startsWith('52') && digits.length >= 12 && digits.length <= 13) return digits
  return ''
}

const IconWhatsApp = () => (
  <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)
const IconPhone = () => (
  <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
  </svg>
)
const IconEmail = () => (
  <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
)
const IconChevronRight = () => (
  <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M9 18l6-6-6-6" />
  </svg>
)

export type GroupedSection = { stage: Stage; leads: Lead[] }

type PipelineTableProps = {
  leads: Lead[]
  stages: Stage[]
  groupByStage?: boolean
  groupedSections?: GroupedSection[]
  getProximaLabel: (stageName: string, next_follow_up_at: string | null | undefined) => ProximaLabel
  onRowClick: (lead: Lead) => void
}

function getTableStagePillClasses(stageName: string | undefined): string {
  const base = getStageTagClasses(stageName)
  return `${base} opacity-90`
}

const NUM_COLS_GROUPED = 5
const NUM_COLS_FLAT = 6

// Column width classes (consistent in grouped and flat)
const COL_LEAD = 'min-w-[140px] w-[22%]'
const COL_CONTACTO = 'min-w-[160px] w-[24%]'
const COL_FUENTE = 'min-w-[90px] w-[14%]'
const COL_PRÓXIMA = 'min-w-[120px] w-[18%]'
const COL_ETAPA = 'min-w-[100px] w-[14%]'
const COL_ACCIONES = 'w-28 min-w-28'

const TH_BASE = 'px-4 py-3 text-[11px] font-medium uppercase tracking-wide text-muted'
const TD_BASE = 'px-4 py-3'

const HEADER_ROW_GROUPED = (
  <tr>
    <th className={`${TH_BASE} text-left ${COL_LEAD}`}>LEAD</th>
    <th className={`${TH_BASE} text-left ${COL_CONTACTO}`}>CONTACTO</th>
    <th className={`${TH_BASE} text-left ${COL_FUENTE}`}>FUENTE</th>
    <th className={`${TH_BASE} text-left ${COL_PRÓXIMA}`}>PRÓXIMA</th>
    <th className={`${TH_BASE} text-right ${COL_ACCIONES}`}>ACCIONES</th>
  </tr>
)
const HEADER_ROW_FLAT = (
  <tr>
    <th className={`${TH_BASE} text-left ${COL_LEAD}`}>LEAD</th>
    <th className={`${TH_BASE} text-left ${COL_CONTACTO}`}>CONTACTO</th>
    <th className={`${TH_BASE} text-left ${COL_FUENTE}`}>FUENTE</th>
    <th className={`${TH_BASE} text-left ${COL_PRÓXIMA}`}>PRÓXIMA</th>
    <th className={`${TH_BASE} text-left ${COL_ETAPA}`}>ETAPA</th>
    <th className={`${TH_BASE} text-right ${COL_ACCIONES}`}>ACCIONES</th>
  </tr>
)

type RowRenderProps = {
  lead: Lead
  stageName: string | undefined
  showEtapaColumn: boolean
  getProximaLabel: (stageName: string, next_follow_up_at: string | null | undefined) => ProximaLabel
  onRowClick: (lead: Lead) => void
}

function PipelineTableRow({ lead, stageName, showEtapaColumn, getProximaLabel, onRowClick }: RowRenderProps) {
  const proxima = getProximaLabel(stageName ?? '', lead.next_follow_up_at)
  const digits = phoneDigits(lead.phone ?? '')
  const waNumber = normalizeWhatsAppNumber(digits)
  const hasPhone = !!(lead.phone?.trim())
  const hasEmail = !!(lead.email?.trim())
  const [actionPart, datePart] = proxima.line.includes(' · ')
    ? proxima.line.split(' · ')
    : [proxima.line, '']

  return (
    <tr
      onClick={() => onRowClick(lead)}
      className="group cursor-pointer bg-white transition-colors hover:bg-neutral-50 focus-within:bg-neutral-50 focus-within:ring-2 focus-within:ring-neutral-200 focus-within:ring-inset"
      style={getStageAccentStyle(stageName)}
    >
      <td className={`${TD_BASE} ${COL_LEAD}`}>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-neutral-900 text-sm">{lead.full_name}</span>
          <span className="opacity-0 text-neutral-300 transition-opacity duration-200 group-hover:opacity-100" aria-hidden>
            <IconChevronRight />
          </span>
        </div>
      </td>
      <td className={`${TD_BASE} ${COL_CONTACTO}`}>
        <div className="text-sm">
          {lead.phone ? (
            <div className="font-mono text-neutral-700 mb-0.5">{lead.phone}</div>
          ) : null}
          {lead.email ? (
            <div className="truncate text-xs text-neutral-500 max-w-[180px]">{lead.email}</div>
          ) : null}
          {!lead.phone && !lead.email ? '—' : null}
        </div>
      </td>
      <td className={`${TD_BASE} ${COL_FUENTE}`}>
        {lead.source ? (
          <span className="text-xs text-neutral-500">{lead.source}</span>
        ) : (
          <span className="text-xs text-neutral-400">—</span>
        )}
      </td>
      <td className={`${TD_BASE} ${COL_PRÓXIMA}`}>
        <div className="text-sm">
          <div className={actionPart === 'Cerrado' ? 'font-medium text-neutral-700' : 'font-medium text-neutral-900'}>
            {actionPart}
          </div>
          {datePart ? <div className="text-xs text-neutral-500">{datePart}</div> : null}
        </div>
      </td>
      {showEtapaColumn && (
        <td className={`${TD_BASE} ${COL_ETAPA}`}>
          <span className={getTableStagePillClasses(stageName)}>{displayStageName(stageName)}</span>
        </td>
      )}
      <td
        className={`${COL_ACCIONES} ${TD_BASE} align-middle`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-[2rem] items-center justify-end gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          {waNumber ? (
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg p-1.5 text-green-600 transition-colors hover:bg-green-50"
              title="WhatsApp"
              aria-label="WhatsApp"
            >
              <IconWhatsApp />
            </a>
          ) : (
            <span className="cursor-not-allowed rounded-lg p-1.5 text-neutral-300" title="Sin número para WhatsApp" aria-hidden>
              <IconWhatsApp />
            </span>
          )}
          {hasPhone ? (
            <a
              href={`tel:${(lead.phone || '').replace(/\s/g, '')}`}
              className="rounded-lg p-1.5 text-blue-600 transition-colors hover:bg-blue-50"
              title="Llamar"
              aria-label="Llamar"
            >
              <IconPhone />
            </a>
          ) : (
            <span className="cursor-not-allowed rounded-lg p-1.5 text-neutral-300" title="Sin teléfono" aria-hidden>
              <IconPhone />
            </span>
          )}
          {hasEmail ? (
            <a
              href={`mailto:${lead.email}`}
              className="rounded-lg p-1.5 text-neutral-600 transition-colors hover:bg-neutral-100"
              title="Email"
              aria-label="Email"
            >
              <IconEmail />
            </a>
          ) : (
            <span className="cursor-not-allowed rounded-lg p-1.5 text-neutral-300" title="Sin email" aria-hidden>
              <IconEmail />
            </span>
          )}
        </div>
      </td>
    </tr>
  )
}

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
  getProximaLabel,
  onRowClick,
}: PipelineTableProps) {
  const showGrouped = groupByStage && groupedSections.length > 0
  const prefersReducedMotion = useReducedMotion()
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({})

  // Estado inicial: etapas con 0 leads colapsadas, con >=1 lead expandidas
  useEffect(() => {
    if (!showGrouped || groupedSections.length === 0) return
    setCollapsedStages((prev) => {
      let next = prev
      for (const { stage, leads: sectionLeads } of groupedSections) {
        if (stage.id in next) continue
        next = { ...next, [stage.id]: sectionLeads.length === 0 }
      }
      return next
    })
  }, [showGrouped, groupedSections])

  const toggleStage = (stageId: string) => {
    setCollapsedStages((prev) => ({ ...prev, [stageId]: !prev[stageId] }))
  }

  if (showGrouped) {
    return (
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              {HEADER_ROW_GROUPED}
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {groupedSections.map(({ stage, leads: sectionLeads }) => {
                const isCollapsed = collapsedStages[stage.id] ?? sectionLeads.length === 0
                return (
                  <Fragment key={stage.id}>
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
                      className="cursor-pointer border-b border-neutral-100 transition-colors hover:bg-black/[0.04] focus:bg-black/[0.04] focus:outline-none focus:ring-2 focus:ring-neutral-200 focus:ring-inset"
                      style={getStageAccentStyle(stage.name)}
                      aria-expanded={!isCollapsed}
                    >
                      <th
                        scope="row"
                        colSpan={NUM_COLS_GROUPED}
                        className="sticky top-0 z-10 flex w-full items-center justify-between gap-2 border-b border-neutral-200 bg-black/[0.02] px-4 py-3 text-left font-medium text-sm text-neutral-800 backdrop-blur-[2px]"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-flex p-1 -m-1 text-neutral-400"
                            style={{
                              transition: prefersReducedMotion ? 'none' : 'transform 0.2s ease',
                              transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)',
                            }}
                            aria-hidden
                          >
                            ▶
                          </span>
                          <span>{displayStageName(stage.name)}</span>
                        </span>
                        <span className="tabular-nums text-xs text-muted">{sectionLeads.length}</span>
                      </th>
                    </tr>
                    {!isCollapsed &&
                      (sectionLeads.length === 0 ? (
                        <tr key={`${stage.id}-empty`}>
                          <td colSpan={NUM_COLS_GROUPED} className="px-4 py-4 text-center text-xs text-muted">
                            Sin leads en esta etapa
                          </td>
                        </tr>
                      ) : (
                        sectionLeads.map((lead) => (
                          <PipelineTableRow
                            key={lead.id}
                            lead={lead}
                            stageName={stage.name}
                            showEtapaColumn={false}
                            getProximaLabel={getProximaLabel}
                            onRowClick={onRowClick}
                          />
                        ))
                      ))}
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
        <table className="w-full">
          <thead className="border-b border-neutral-200 bg-neutral-50">
            {HEADER_ROW_FLAT}
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={NUM_COLS_FLAT} className="px-4 py-12 text-center text-sm text-muted">
                  No se encontraron leads con los filtros aplicados
                </td>
              </tr>
            ) : (
              leads.map((lead) => {
                const stageName = stages.find((s) => s.id === lead.stage_id)?.name
                return (
                  <PipelineTableRow
                    key={lead.id}
                    lead={lead}
                    stageName={stageName}
                    showEtapaColumn={true}
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
