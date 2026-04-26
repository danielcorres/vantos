import { useState } from 'react'
import { useCampaignDashboard } from '../hooks/useCampaignDashboard'
import { useCampaignsConfig } from '../hooks/useCampaignsConfig'
import { CampaignCard } from '../components/CampaignCard'
import { CareerCampaignCard } from '../components/CareerCampaignCard'
import { CampaignRankingTable } from '../components/CampaignRankingTable'
import { formatPeriodo } from '../utils/campaignProgress'
import type { DashboardEntry, DashboardLevelSummary } from '../domain/types'

export function AdvisorCampaignsPage() {
  const [periodo, setPeriodo] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const { entries, loading, error } = useCampaignDashboard(periodo)
  const { campaigns } = useCampaignsConfig()

  // Agrupar entries por campaign_id
  const byCampaign = entries.reduce<Record<string, DashboardEntry[]>>((acc, e) => {
    if (!acc[e.campaign_id]) acc[e.campaign_id] = []
    acc[e.campaign_id].push(e)
    return acc
  }, {})

  const campaignMap = Object.fromEntries(campaigns.map(c => [c.id, c]))

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header + selector de periodo */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-text dark:text-neutral-100">Mis Campañas</h1>
          <p className="text-sm text-muted">{formatPeriodo(periodo)}</p>
        </div>
        <input
          type="month"
          value={periodo}
          onChange={e => setPeriodo(e.target.value)}
          className="text-sm px-3 py-1.5 border border-border dark:border-neutral-600 rounded-lg bg-transparent dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-36 bg-zinc-100 dark:bg-neutral-800 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="p-4 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 rounded-xl border border-red-200 dark:border-red-700">
          {error}
        </div>
      )}

      {!loading && !error && Object.keys(byCampaign).length === 0 && (
        <div className="text-center py-16 text-muted">
          <p className="text-sm">No hay datos de campañas para {formatPeriodo(periodo)}.</p>
        </div>
      )}

      {!loading && !error && Object.entries(byCampaign).map(([campaignId, campEntries]) => {
        const campaign = campaignMap[campaignId]
        if (!campaign) return null

        // Para campañas multi_track: sección por track
        if (campaign.campaign_type === 'multi_track') {
          return (
            <div key={campaignId} className="space-y-3">
              <div className="flex items-center gap-2">
                {campaign.color && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: campaign.color }} />}
                <h2 className="text-base font-semibold text-text dark:text-neutral-100">{campaign.name}</h2>
              </div>
              {campEntries.map(e => (
                <CampaignCard key={e.snapshot_id} entry={e} campaign={campaign} />
              ))}
            </div>
          )
        }

        // Para campañas de carrera: vista timeline
        if (campaign.campaign_type === 'new_advisor_path') {
          const entry = campEntries[0]
          if (!entry) return null
          // Construir lista de niveles desde el entry para la vista de carrera
          const allLevels: DashboardLevelSummary[] = []
          if (entry.current_level) allLevels.push(entry.current_level)
          if (entry.next_level) allLevels.push(entry.next_level)
          return (
            <CareerCampaignCard
              key={campaignId}
              entry={entry}
              campaign={campaign}
              levels={allLevels}
            />
          )
        }

        // Por defecto: CampaignCard estándar
        return campEntries.map(e => (
          <CampaignCard key={e.snapshot_id} entry={e} campaign={campaign} />
        ))
      })}

      {/* Ranking (lazy load) */}
      {!loading && entries.length > 0 && (
        <div className="space-y-4 border-t border-border dark:border-neutral-700 pt-4">
          <h2 className="text-sm font-semibold text-text dark:text-neutral-100">Ranking</h2>
          {[...new Set(entries.map(e => e.campaign_id))].map(campaignId => {
            const campaign = campaignMap[campaignId]
            if (!campaign) return null
            return (
              <div key={campaignId} className="space-y-2">
                <p className="text-xs text-muted font-medium">{campaign.name}</p>
                <CampaignRankingTable
                  periodo={periodo}
                  campaignId={campaignId}
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
