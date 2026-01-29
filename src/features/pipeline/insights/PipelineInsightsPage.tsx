import { useState, useEffect } from 'react'
import { insightsApi } from './insights.api'
import type {
  PipelineKpisToday,
  PipelineFunnelRow,
  PipelineDurationRow,
  PipelineTransitionRow,
  CloseToWonKpi,
} from './insights.types'
import { KpiCards } from './components/KpiCards'
import { FunnelList } from './components/FunnelList'
import { DurationTable } from './components/DurationTable'
import { StuckLeadsPanel } from './components/StuckLeadsPanel'
import { TransitionsTable } from './components/TransitionsTable'

interface PipelineInsightsPageProps {
  onViewInKanban: (leadId?: string) => void
}

export function PipelineInsightsPage({ onViewInKanban }: PipelineInsightsPageProps) {
  const [kpis, setKpis] = useState<PipelineKpisToday | null>(null)
  const [closeToWon, setCloseToWon] = useState<CloseToWonKpi | null>(null)
  const [funnel, setFunnel] = useState<PipelineFunnelRow[]>([])
  const [duration, setDuration] = useState<PipelineDurationRow[]>([])
  const [transitions, setTransitions] = useState<PipelineTransitionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [kpisData, closeToWonData, funnelData, durationData, transitionsData] = await Promise.all([
        insightsApi.getKpisToday(),
        insightsApi.getCloseToWonKpi().catch(() => ({ avgDays: null, count: 0, rows: [] })),
        insightsApi.getFunnelCurrent(),
        insightsApi.getDurationStats30d(),
        insightsApi.getTransitions30d(),
      ])
      setKpis(kpisData)
      setCloseToWon(closeToWonData)
      setFunnel(funnelData)
      setDuration(durationData)
      setTransitions(transitionsData)
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

      <KpiCards kpis={kpis} closeToWon={closeToWon} loading={loading} />
      <FunnelList funnel={funnel} loading={loading} />
      <DurationTable duration={duration} loading={loading} />
      <StuckLeadsPanel onViewInKanban={handleViewInKanban} />
      <TransitionsTable transitions={transitions} loading={loading} />
    </div>
  )
}
