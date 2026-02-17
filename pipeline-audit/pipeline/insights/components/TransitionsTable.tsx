import type { PipelineTransitionRow } from '../insights.types'

interface TransitionsTableProps {
  transitions: PipelineTransitionRow[]
  loading: boolean
}

export function TransitionsTable({ transitions, loading }: TransitionsTableProps) {
  if (loading) {
    return (
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 className="title" style={{ marginBottom: '16px' }}>Transiciones 30 días</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border)' }}>
                  De
                </th>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border)' }}>
                  A
                </th>
                <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid var(--border)' }}>
                  Movimientos 30d
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (transitions.length === 0) {
    return (
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3 className="title" style={{ marginBottom: '16px' }}>Transiciones 30 días</h3>
        <div className="muted" style={{ textAlign: 'center', padding: '24px' }}>
          Aún no hay transiciones en los últimos 30 días.
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      <h3 className="title" style={{ marginBottom: '16px' }}>Transiciones 30 días</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border)' }}>
                De
              </th>
              <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border)' }}>
                A
              </th>
              <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid var(--border)' }}>
                Movimientos 30d
              </th>
            </tr>
          </thead>
          <tbody>
            {transitions.map((row, idx) => (
              <tr key={`${row.from_stage_id}-${row.to_stage_id}-${idx}`}>
                <td style={{ padding: '8px' }}>{row.from_stage_name}</td>
                <td style={{ padding: '8px' }}>{row.to_stage_name}</td>
                <td style={{ padding: '8px', textAlign: 'right', fontWeight: '600' }}>
                  {row.moves_30d}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
