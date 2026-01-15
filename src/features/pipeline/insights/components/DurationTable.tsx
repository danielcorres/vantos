import type { PipelineDurationRow } from '../insights.types'

interface DurationTableProps {
  duration: PipelineDurationRow[]
  loading: boolean
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return '0 min'
  
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (days > 0) {
    return `${days} día${days > 1 ? 's' : ''}`
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes} min`
}

export function DurationTable({ duration, loading }: DurationTableProps) {
  if (loading) {
    return (
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 className="title" style={{ marginBottom: '16px' }}>Duración por etapa (30 días)</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border)' }}>
                  Etapa
                </th>
                <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid var(--border)' }}>
                  Muestras
                </th>
                <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid var(--border)' }}>
                  Promedio
                </th>
                <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid var(--border)' }}>
                  Mediana
                </th>
                <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid var(--border)' }}>
                  P90
                </th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((i) => (
                <tr key={i}>
                  <td style={{ padding: '8px' }}>
                    <div style={{ height: '20px', background: 'var(--bg)', borderRadius: '4px' }} />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <div style={{ height: '20px', background: 'var(--bg)', borderRadius: '4px' }} />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <div style={{ height: '20px', background: 'var(--bg)', borderRadius: '4px' }} />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <div style={{ height: '20px', background: 'var(--bg)', borderRadius: '4px' }} />
                  </td>
                  <td style={{ padding: '8px' }}>
                    <div style={{ height: '20px', background: 'var(--bg)', borderRadius: '4px' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (duration.length === 0) {
    return (
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 className="title" style={{ marginBottom: '16px' }}>Duración por etapa (30 días)</h3>
        <div className="muted" style={{ textAlign: 'center', padding: '24px' }}>
          Aún no hay movimientos en los últimos 30 días.
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      <h3 className="title" style={{ marginBottom: '16px' }}>Duración por etapa (30 días)</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border)' }}>
                Etapa
              </th>
              <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid var(--border)' }}>
                Muestras 30d
              </th>
              <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid var(--border)' }}>
                Promedio
              </th>
              <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid var(--border)' }}>
                Mediana
              </th>
              <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid var(--border)' }}>
                P90
              </th>
            </tr>
          </thead>
          <tbody>
            {duration.map((row) => (
              <tr key={row.stage_id}>
                <td style={{ padding: '8px', fontWeight: '600' }}>{row.stage_name}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>{row.samples_30d}</td>
                <td style={{ padding: '8px', textAlign: 'right' }}>
                  {formatDuration(row.avg_seconds_30d)}
                </td>
                <td style={{ padding: '8px', textAlign: 'right' }}>
                  {formatDuration(row.median_seconds_30d)}
                </td>
                <td style={{ padding: '8px', textAlign: 'right' }}>
                  {formatDuration(row.p90_seconds_30d)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
