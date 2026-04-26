import { useState } from 'react'
import { useCampaignDashboard } from '../hooks/useCampaignDashboard'
import { useCampaignsConfig } from '../hooks/useCampaignsConfig'
import { CampaignProgressBar } from '../components/CampaignProgressBar'
import { CampaignRewardBadge } from '../components/CampaignRewardBadge'
import { CampaignRankingTable } from '../components/CampaignRankingTable'
import { getProgressPercent, getCurrentLevelLabel, formatValue, formatPeriodo } from '../utils/campaignProgress'
import type { DashboardEntry } from '../domain/types'

export function ManagerCampaignsPage() {
  const [periodo, setPeriodo] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)

  const { entries, loading, error } = useCampaignDashboard(periodo)
  const { campaigns } = useCampaignsConfig()

  const campaignMap = Object.fromEntries(campaigns.map(c => [c.id, c]))

  // Agrupar por asesor
  const byAdvisor = entries.reduce<Record<string, { name: string; entries: DashboardEntry[] }>>((acc, e) => {
    if (!acc[e.user_id]) acc[e.user_id] = { name: e.display_name, entries: [] }
    acc[e.user_id].entries.push(e)
    return acc
  }, {})

  // IDs únicos de campañas con datos
  const uniqueCampaignIds = [...new Set(entries.map(e => e.campaign_id))]

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-text dark:text-neutral-100">Campañas — Mi equipo</h1>
          <p className="text-sm text-muted">{formatPeriodo(periodo)}</p>
        </div>
        <input
          type="month"
          value={periodo}
          onChange={e => setPeriodo(e.target.value)}
          className="text-sm px-3 py-1.5 border border-border dark:border-neutral-600 rounded-lg bg-transparent dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Filtro por campaña */}
      {uniqueCampaignIds.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCampaignId(null)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              !selectedCampaignId
                ? 'bg-primary text-white border-primary'
                : 'border-border text-text dark:border-neutral-600 dark:text-neutral-100 hover:bg-zinc-100 dark:hover:bg-neutral-700'
            }`}
          >
            Todas
          </button>
          {uniqueCampaignIds.map(cid => {
            const c = campaignMap[cid]
            if (!c) return null
            return (
              <button
                key={cid}
                onClick={() => setSelectedCampaignId(cid)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  selectedCampaignId === cid
                    ? 'bg-primary text-white border-primary'
                    : 'border-border text-text dark:border-neutral-600 dark:text-neutral-100 hover:bg-zinc-100 dark:hover:bg-neutral-700'
                }`}
              >
                {c.name}
              </button>
            )
          })}
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-zinc-100 dark:bg-neutral-800 rounded-xl animate-pulse" />)}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {!loading && !error && Object.keys(byAdvisor).length === 0 && (
        <p className="text-center text-sm text-muted py-12">No hay datos para {formatPeriodo(periodo)}.</p>
      )}

      {/* Tabla de asesores */}
      {!loading && !error && Object.keys(byAdvisor).length > 0 && (
        <div className="space-y-2">
          {Object.entries(byAdvisor).map(([userId, { name, entries: aEntries }]) => {
            const filteredEntries = selectedCampaignId
              ? aEntries.filter(e => e.campaign_id === selectedCampaignId)
              : aEntries

            if (filteredEntries.length === 0) return null

            return (
              <div
                key={userId}
                className="bg-surface dark:bg-neutral-800 border border-border dark:border-neutral-700 rounded-xl p-3 space-y-2"
              >
                <p className="text-sm font-medium text-text dark:text-neutral-100">{name}</p>
                <div className="space-y-1.5">
                  {filteredEntries.map(e => {
                    const campaign = campaignMap[e.campaign_id]
                    if (!campaign) return null
                    return (
                      <div key={e.snapshot_id} className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between text-xs text-muted mb-1">
                            <span>{campaign.name}</span>
                            <span className="font-medium text-text dark:text-neutral-100">
                              {formatValue(e.value, campaign.unit_label)}
                            </span>
                          </div>
                          <CampaignProgressBar percent={getProgressPercent(e)} color={campaign.color ?? '#3B82F6'} />
                        </div>
                        <div className="shrink-0 text-xs text-muted w-20 text-right">
                          {getCurrentLevelLabel(e)}
                        </div>
                        {e.award_status && (
                          <CampaignRewardBadge status={e.award_status} />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Ranking */}
      {!loading && entries.length > 0 && (
        <div className="space-y-4 border-t border-border dark:border-neutral-700 pt-4">
          <h2 className="text-sm font-semibold text-text dark:text-neutral-100">Ranking general</h2>
          {(selectedCampaignId ? [selectedCampaignId] : uniqueCampaignIds).map(cid => {
            const campaign = campaignMap[cid]
            if (!campaign) return null
            return (
              <div key={cid} className="space-y-2">
                <p className="text-xs text-muted font-medium">{campaign.name}</p>
                <CampaignRankingTable
                  periodo={periodo}
                  campaignId={cid}
                  unitLabel={campaign.unit_label}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
