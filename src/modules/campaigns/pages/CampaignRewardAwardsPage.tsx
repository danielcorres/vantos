import { useState } from 'react'
import { useCampaignRewardAwards } from '../hooks/useCampaignRewardAwards'
import { useCampaignsConfig } from '../hooks/useCampaignsConfig'
import {
  getAwardStatusLabel,
  getAwardStatusColor,
  getValidNextStatuses,
  formatValue,
  formatPeriodo,
} from '../utils/campaignProgress'
import type { AwardStatus } from '../domain/types'

export function CampaignRewardAwardsPage() {
  const [periodo, setPeriodo] = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [confirmChange, setConfirmChange] = useState<{
    awardId: string
    newStatus: AwardStatus
    currentName: string
  } | null>(null)
  const [notes, setNotes] = useState('')
  const [transitioning, setTransitioning] = useState(false)
  const [transitionError, setTransitionError] = useState<string | null>(null)

  const { awards, loading, error, reload, changeStatus } = useCampaignRewardAwards({
    periodo: periodo || undefined,
    campaignId: campaignId || undefined,
    status: statusFilter || undefined,
  })

  const { campaigns } = useCampaignsConfig()
  const campaignMap = Object.fromEntries(campaigns.map(c => [c.id, c]))

  const ALL_STATUSES: AwardStatus[] = [
    'projected', 'eligible', 'pending_validation', 'earned', 'confirmed', 'delivered', 'lost', 'recovered', 'cancelled'
  ]

  const handleConfirmTransition = async () => {
    if (!confirmChange) return
    setTransitioning(true)
    setTransitionError(null)
    try {
      await changeStatus(confirmChange.awardId, confirmChange.newStatus, notes || undefined)
      setConfirmChange(null)
      setNotes('')
    } catch (e) {
      setTransitionError(e instanceof Error ? e.message : 'Error al cambiar estado')
    } finally {
      setTransitioning(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-text dark:text-neutral-100">Premios Ganados</h1>
          <p className="text-sm text-muted">Gestiona el estado de los premios de campaña.</p>
        </div>
        <button
          onClick={() => void reload()}
          className="text-sm px-3 py-1.5 border border-border dark:border-neutral-600 rounded-lg text-text dark:text-neutral-100 hover:bg-zinc-100 dark:hover:bg-neutral-700 transition-colors"
        >
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap items-center">
        <input
          type="text"
          value={periodo}
          onChange={e => setPeriodo(e.target.value)}
          placeholder="Periodo (ej. 2026-05)"
          className="text-sm px-3 py-1.5 border border-border dark:border-neutral-600 rounded-lg bg-transparent dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary w-44"
        />
        <select
          value={campaignId}
          onChange={e => setCampaignId(e.target.value)}
          className="text-sm px-3 py-1.5 border border-border dark:border-neutral-600 rounded-lg bg-transparent dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Todas las campañas</option>
          {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-sm px-3 py-1.5 border border-border dark:border-neutral-600 rounded-lg bg-transparent dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">Todos los estados</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{getAwardStatusLabel(s)}</option>)}
        </select>
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-zinc-100 dark:bg-neutral-800 rounded-xl animate-pulse" />)}
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!loading && !error && awards.length === 0 && (
        <p className="text-center text-sm text-muted py-12">No hay premios con los filtros actuales.</p>
      )}

      {/* Tabla */}
      {!loading && !error && awards.length > 0 && (
        <div className="bg-surface dark:bg-neutral-800 border border-border dark:border-neutral-700 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 dark:bg-neutral-900/50">
                <tr className="border-b border-border dark:border-neutral-700 text-left text-xs text-muted">
                  <th className="px-4 py-2 font-medium">Campaña</th>
                  <th className="px-4 py-2 font-medium">Periodo</th>
                  <th className="px-4 py-2 font-medium">Asesor</th>
                  <th className="px-4 py-2 font-medium">Valor</th>
                  <th className="px-4 py-2 font-medium">Estado</th>
                  <th className="px-4 py-2 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-neutral-700">
                {awards.map(award => {
                  const campaign = campaignMap[award.campaign_id]
                  const validNext = getValidNextStatuses(award.status)

                  return (
                    <tr key={award.id}>
                      <td className="px-4 py-2.5 font-medium text-text dark:text-neutral-100">
                        {campaign?.name ?? award.campaign_id}
                      </td>
                      <td className="px-4 py-2.5 text-muted">
                        {formatPeriodo(award.periodo)}
                      </td>
                      <td className="px-4 py-2.5 text-text dark:text-neutral-100 text-xs font-mono">
                        {award.user_id.slice(0, 8)}…
                      </td>
                      <td className="px-4 py-2.5 text-text dark:text-neutral-100">
                        {formatValue(award.value_at_award, campaign?.unit_label)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getAwardStatusColor(award.status)}`}>
                          {getAwardStatusLabel(award.status)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {validNext.length > 0 && (
                          <div className="flex gap-1 flex-wrap">
                            {validNext.map(ns => (
                              <button
                                key={ns}
                                onClick={() => setConfirmChange({ awardId: award.id, newStatus: ns, currentName: `${campaign?.name ?? ''} — ${award.periodo}` })}
                                className="text-xs px-2 py-0.5 border border-border dark:border-neutral-600 rounded text-text dark:text-neutral-100 hover:bg-zinc-100 dark:hover:bg-neutral-700 transition-colors"
                              >
                                → {getAwardStatusLabel(ns)}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de confirmación de transición */}
      {confirmChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/60 px-4">
          <div className="w-full max-w-sm bg-white dark:bg-neutral-900 border border-border dark:border-neutral-700 rounded-2xl p-5 space-y-4 shadow-xl">
            <h2 className="text-base font-semibold text-text dark:text-neutral-100">Confirmar cambio de estado</h2>
            <p className="text-sm text-muted">
              Cambiar estado de <span className="font-medium text-text dark:text-neutral-100">{confirmChange.currentName}</span> a{' '}
              <span className={`font-medium px-1.5 py-0.5 rounded ${getAwardStatusColor(confirmChange.newStatus)}`}>
                {getAwardStatusLabel(confirmChange.newStatus)}
              </span>
            </p>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Notas (opcional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="w-full text-sm px-3 py-1.5 border border-border dark:border-neutral-600 rounded-lg bg-transparent dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                placeholder="Motivo del cambio…"
              />
            </div>
            {transitionError && <p className="text-xs text-red-600 dark:text-red-400">{transitionError}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setConfirmChange(null); setNotes(''); setTransitionError(null) }}
                className="text-sm px-4 py-2 border border-border dark:border-neutral-600 rounded-lg text-text dark:text-neutral-100 hover:bg-zinc-100 dark:hover:bg-neutral-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleConfirmTransition()}
                disabled={transitioning}
                className="text-sm px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {transitioning ? 'Guardando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
