import { useState, useEffect } from 'react'
import { insightsApi } from '../insights.api'
import type { StuckLeadRow } from '../insights.types'

interface StuckLeadsPanelProps {
  onViewInKanban: (leadId: string) => void
}

export function StuckLeadsPanel({ onViewInKanban }: StuckLeadsPanelProps) {
  const [days, setDays] = useState(7)
  const [leads, setLeads] = useState<StuckLeadRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadStuckLeads()
  }, [days])

  const loadStuckLeads = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await insightsApi.getStuckLeads(days)
      setLeads(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar leads estancados')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      <div className="row space-between" style={{ marginBottom: '16px' }}>
        <h3 className="title">Leads estancados</h3>
        <div className="row" style={{ gap: '8px' }}>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}
          >
            <option value={3}>Estancados desde: 3 días</option>
            <option value={7}>Estancados desde: 7 días</option>
            <option value={14}>Estancados desde: 14 días</option>
          </select>
          <button
            onClick={loadStuckLeads}
            className="btn btn-ghost"
            disabled={loading}
            style={{ fontSize: '12px', padding: '6px 10px' }}
          >
            {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-box" style={{ marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {loading && leads.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: '60px', background: 'var(--bg)', borderRadius: '8px' }} />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="muted" style={{ textAlign: 'center', padding: '24px' }}>
          No hay leads estancados por {days} día{days > 1 ? 's' : ''} o más.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border)' }}>
                  Nombre
                </th>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border)' }}>
                  Etapa
                </th>
                <th style={{ textAlign: 'right', padding: '8px', borderBottom: '1px solid var(--border)' }}>
                  Días en etapa
                </th>
                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--border)' }}>
                  Contacto
                </th>
                <th style={{ textAlign: 'center', padding: '8px', borderBottom: '1px solid var(--border)' }}>
                  Acción
                </th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.lead_id}>
                  <td style={{ padding: '8px', fontWeight: '600' }}>{lead.full_name}</td>
                  <td style={{ padding: '8px' }}>{lead.stage_name}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: '600' }}>
                    {lead.days_in_stage}
                  </td>
                  <td style={{ padding: '8px', fontSize: '12px' }}>
                    {lead.phone && <div>📞 {lead.phone}</div>}
                    {lead.email && <div>✉️ {lead.email}</div>}
                    {!lead.phone && !lead.email && <span className="muted">Sin contacto</span>}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>
                    <button
                      onClick={() => onViewInKanban(lead.lead_id)}
                      className="btn btn-ghost"
                      style={{ fontSize: '12px', padding: '4px 8px' }}
                    >
                      Ver en Kanban
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
