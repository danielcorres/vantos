import type { PipelineKpisToday } from '../insights.types'

interface KpiCardsProps {
  kpis: PipelineKpisToday | null
  loading: boolean
}

export function KpiCards({ kpis, loading }: KpiCardsProps) {
  if (loading) {
    return (
      <div className="row" style={{ gap: '16px', marginBottom: '24px' }}>
        <div className="card" style={{ flex: 1 }}>
          <div className="muted" style={{ marginBottom: '8px' }}>Movimientos hoy</div>
          <div style={{ height: '32px', background: 'var(--bg)', borderRadius: '8px' }} />
        </div>
        <div className="card" style={{ flex: 1 }}>
          <div className="muted" style={{ marginBottom: '8px' }}>Leads creados hoy</div>
          <div style={{ height: '32px', background: 'var(--bg)', borderRadius: '8px' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="row" style={{ gap: '16px', marginBottom: '24px' }}>
      <div className="card" style={{ flex: 1 }}>
        <div className="muted" style={{ marginBottom: '8px' }}>Movimientos hoy</div>
        <div className="kpi">{kpis?.moves_today ?? 0}</div>
      </div>
      <div className="card" style={{ flex: 1 }}>
        <div className="muted" style={{ marginBottom: '8px' }}>Leads creados hoy</div>
        <div className="kpi">{kpis?.leads_created_today ?? 0}</div>
      </div>
    </div>
  )
}
