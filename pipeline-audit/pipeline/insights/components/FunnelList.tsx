import type { PipelineFunnelRow } from '../insights.types'

interface FunnelListProps {
  funnel: PipelineFunnelRow[]
  loading: boolean
}

export function FunnelList({ funnel, loading }: FunnelListProps) {
  if (loading) {
    return (
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 className="title" style={{ marginBottom: '16px' }}>Embudo actual</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: '40px', background: 'var(--bg)', borderRadius: '8px' }} />
          ))}
        </div>
      </div>
    )
  }

  if (funnel.length === 0) {
    return (
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 className="title" style={{ marginBottom: '16px' }}>Embudo actual</h3>
        <div className="muted" style={{ textAlign: 'center', padding: '24px' }}>
          Aún no hay leads en el pipeline.
        </div>
      </div>
    )
  }

  const maxLeads = Math.max(...funnel.map((f) => f.leads_count), 1)

  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      <h3 className="title" style={{ marginBottom: '16px' }}>Embudo actual</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {funnel.map((row) => (
          <div key={row.stage_id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ minWidth: '120px', fontWeight: '600' }}>{row.stage_name}</div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  flex: 1,
                  height: '24px',
                  background: 'var(--bg)',
                  borderRadius: '6px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${(row.leads_count / maxLeads) * 100}%`,
                    height: '100%',
                    background: 'var(--text)',
                    opacity: 0.2,
                  }}
                />
              </div>
              <div style={{ minWidth: '40px', textAlign: 'right', fontWeight: '600' }}>
                {row.leads_count}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
