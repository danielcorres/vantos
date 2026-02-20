import { useState, useEffect } from 'react'
import { insightsApi } from './insights.api'
import type {
  PipelineKpisToday,
  PipelineFunnelRow,
  PipelineDurationRow,
  PipelineTransitionRow,
  CloseToWonKpi,
  MonthlyProductionCounts,
} from './insights.types'
import { KpiCards } from './components/KpiCards'
import { FunnelList } from './components/FunnelList'
import { ResultadosDelMesPanel } from './components/ResultadosDelMesPanel'
import { DurationTable } from './components/DurationTable'
import { StuckLeadsPanel } from './components/StuckLeadsPanel'
import { TransitionsTable } from './components/TransitionsTable'

interface PipelineInsightsPageProps {
  onViewInKanban: (leadId?: string) => void
}

export function PipelineInsightsPage({ onViewInKanban }: PipelineInsightsPageProps) {
  const [kpis, setKpis] = useState<PipelineKpisToday | null>(null)
  const [closeToWon, setCloseToWon] = useState<CloseToWonKpi | null>(null)
  const [conditionCounts, setConditionCounts] = useState<{ withCondition: number; negative: number } | null>(null)
  const [funnel, setFunnel] = useState<PipelineFunnelRow[]>([])
  const [duration, setDuration] = useState<PipelineDurationRow[]>([])
  const [transitions, setTransitions] = useState<PipelineTransitionRow[]>([])
  const [monthlyProduction, setMonthlyProduction] = useState<MonthlyProductionCounts | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [
        kpisData,
        closeToWonData,
        conditionData,
        funnelData,
        durationData,
        transitionsData,
        monthlyProductionData,
      ] = await Promise.all([
        insightsApi.getKpisToday(),
        insightsApi.getCloseToWonKpi().catch(() => ({ avgDays: null, count: 0, rows: [] })),
        insightsApi.getConditionCounts().catch(() => ({ withCondition: 0, negative: 0 })),
        insightsApi.getFunnelCurrent(),
        insightsApi.getDurationStats30d(),
        insightsApi.getTransitions30d(),
        insightsApi.getMonthlyProductionCounts().catch(() => ({
          casos_abiertos: 0,
          citas_cierre: 0,
          casos_ganados: 0,
        })),
      ])
      setKpis(kpisData)
      setCloseToWon(closeToWonData)
      setConditionCounts(conditionData)
      setFunnel(funnelData)
      setDuration(durationData)
      setTransitions(transitionsData)
      setMonthlyProduction(monthlyProductionData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar insights')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleViewInKanban = (leadId: string) => {
    onViewInKanban(leadId)
  }

  return (
    <div>
      <div className="row space-between" style={{ marginBottom: '24px' }}>
        <h2 className="title">Insights del Pipeline</h2>
        <button onClick={loadData} className="btn btn-ghost" disabled={loading}>
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </div>

      {error && (
        <div className="error-box" style={{ marginBottom: '16px' }}>
          {error}
        </div>
      )}

      <KpiCards kpis={kpis} closeToWon={closeToWon} conditionCounts={conditionCounts} loading={loading} />
      <ResultadosDelMesPanel counts={monthlyProduction} loading={loading} />
      <FunnelList funnel={funnel} loading={loading} />
      <DurationTable duration={duration} loading={loading} />
      <StuckLeadsPanel onViewInKanban={handleViewInKanban} />
      <TransitionsTable transitions={transitions} loading={loading} />
    </div>
  )
}
