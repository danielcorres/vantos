import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getWeeklyEntryLeads } from '../api/drilldown.api'
import type { StageSlug } from '../types/productivity.types'
import type { WeeklyEntryLead } from '../types/productivity.types'

function formatEntro(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('es-MX', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

function formatFollowUp(ymd: string): string {
  try {
    const [y, m, d] = ymd.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    return date.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })
  } catch {
    return ymd
  }
}

interface StageDrilldownModalProps {
  isOpen: boolean
  onClose: () => void
  stageSlug: StageSlug
  stageLabel: string
  weekStartYmd: string
}

export function StageDrilldownModal({
  isOpen,
  onClose,
  stageSlug,
  stageLabel,
  weekStartYmd,
}: StageDrilldownModalProps) {
  const navigate = useNavigate()
  const [leads, setLeads] = useState<WeeklyEntryLead[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !weekStartYmd) return
    setLoading(true)
    setError(null)
    getWeeklyEntryLeads(weekStartYmd, stageSlug)
      .then(setLeads)
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar'))
      .finally(() => setLoading(false))
  }, [isOpen, weekStartYmd, stageSlug])

  const handleRowClick = (leadId: string) => {
    onClose()
    navigate(`/leads/${leadId}`)
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="stage-drilldown-title"
    >
      <div
        className="bg-bg border border-border rounded-t-2xl sm:rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-border flex items-center justify-between shrink-0">
          <h2 id="stage-drilldown-title" className="text-lg font-semibold text-text">
            Entradas esta semana · {stageLabel}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted hover:text-text hover:bg-black/5 rounded-lg transition-colors"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm p-3 mb-3">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-14 rounded-lg bg-black/5 animate-pulse" />
              ))}
            </div>
          ) : leads.length === 0 ? (
            <p className="text-sm text-muted">Ningún lead entró a esta etapa esta semana.</p>
          ) : (
            <ul className="space-y-1">
              {leads.map((lead) => (
                <li key={lead.lead_id}>
                  <button
                    type="button"
                    onClick={() => handleRowClick(lead.lead_id)}
                    className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-black/5 transition-colors border border-transparent hover:border-border"
                  >
                    <div className="font-medium text-text text-sm">
                      {lead.lead_name?.trim() || 'Sin nombre'}
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      Entró: {formatEntro(lead.moved_at)}
                    </div>
                    {lead.next_follow_up_at && (
                      <div
                        className="text-xs text-muted mt-0.5"
                        title={`Próximo seguimiento: ${formatFollowUp(lead.next_follow_up_at)}`}
                      >
                        Seguimiento: {formatFollowUp(lead.next_follow_up_at)}
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
