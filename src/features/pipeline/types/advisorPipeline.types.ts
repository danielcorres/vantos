export type AdvisorPipelineRow = {
  slug: string
  stage_name: string
  position: number
  current_count: number
  week_entries: number
}

export type AdvisorPipelineSummaryData = {
  rows: AdvisorPipelineRow[]
  totalActive: number
  /** Suma de week_entries en todas las etapas (entradas distintas por lead+etapa en la semana) */
  weekEntriesTotal: number
  wonThisWeek: number
  newThisWeek: number
  /** % de leads activos que están hoy en casos_ganados (snapshot) */
  conversionPct: number | null
}
