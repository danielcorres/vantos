import type { PipelineKpisToday, CloseToWonKpi } from '../insights.types'

interface KpiCardsProps {
  kpis: PipelineKpisToday | null
  closeToWon: CloseToWonKpi | null
  loading: boolean
}

export function KpiCards({ kpis, closeToWon, loading }: KpiCardsProps) {
  if (loading) {
    return (
      <div className="row" style={{ gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: 1, minWidth: '140px' }}>
          <div className="muted" style={{ marginBottom: '8px' }}>Movimientos hoy</div>
          <div style={{ height: '32px', background: 'var(--bg)', borderRadius: '8px' }} />
        </div>
        <div className="card" style={{ flex: 1, minWidth: '140px' }}>
          <div className="muted" style={{ marginBottom: '8px' }}>Leads creados hoy</div>
          <div style={{ height: '32px', background: 'var(--bg)', borderRadius: '8px' }} />
        </div>
        <div className="card" style={{ flex: 1, minWidth: '140px' }}>
          <div className="muted" style={{ marginBottom: '8px' }}>Días de cierre a ganado</div>
          <div style={{ height: '32px', background: 'var(--bg)', borderRadius: '8px' }} />
        </div>
      </div>
    )
  }

  const closeToWonValue =
    closeToWon && closeToWon.count > 0 && closeToWon.avgDays != null
      ? `${closeToWon.avgDays} d`
      : '—'
  const closeToWonN = closeToWon?.count ?? 0

  return (
    <div className="row" style={{ gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
      <div className="card" style={{ flex: 1, minWidth: '140px' }}>
        <div className="muted" style={{ marginBottom: '8px' }}>Movimientos hoy</div>
        <div className="kpi">{kpis?.moves_today ?? 0}</div>
      </div>
      <div className="card" style={{ flex: 1, minWidth: '140px' }}>
        <div className="muted" style={{ marginBottom: '8px' }}>Leads creados hoy</div>
        <div className="kpi">{kpis?.leads_created_today ?? 0}</div>
      </div>
      <div className="card" style={{ flex: 1, minWidth: '140px' }}>
        <div className="muted" style={{ marginBottom: '8px' }}>Días de cierre a ganado</div>
        <div className="kpi">{closeToWonValue}</div>
        <div className="muted" style={{ fontSize: '11px', marginTop: '4px' }}>
          n={closeToWonN} · Última presentación realizada → ganado
        </div>
      </div>
    </div>
  )
}
