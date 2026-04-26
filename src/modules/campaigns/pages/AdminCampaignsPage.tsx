import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCampaignDashboard } from '../hooks/useCampaignDashboard'
import { useCampaignsConfig } from '../hooks/useCampaignsConfig'
import { useCampaignImports } from '../hooks/useCampaignImports'
import { CampaignProgressBar } from '../components/CampaignProgressBar'
import { CampaignRewardBadge } from '../components/CampaignRewardBadge'
import { SyncButton } from '../components/SyncButton'
import { getProgressPercent, getCurrentLevelLabel, formatValue, formatPeriodo } from '../utils/campaignProgress'

export function AdminCampaignsPage() {
  const [periodo, setPeriodo] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const { entries, loading, error, reload } = useCampaignDashboard(periodo)
  const { campaigns } = useCampaignsConfig()
  const { imports } = useCampaignImports(5)

  const campaignMap = Object.fromEntries(campaigns.map(c => [c.id, c]))
  const uniqueCampaignIds = [...new Set(entries.map(e => e.campaign_id))]

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-xl font-bold text-text dark:text-neutral-100">Campañas</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="month"
            value={periodo}
            onChange={e => setPeriodo(e.target.value)}
            className="text-sm px-3 py-1.5 border border-border dark:border-neutral-600 rounded-lg bg-transparent dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Link
            to="/indicadores/config"
            className="text-sm px-3 py-1.5 border border-primary text-primary hover:bg-primary/5 rounded-lg transition-colors"
          >
            Configurar campañas
          </Link>
          <Link
            to="/indicadores/premios"
            className="text-sm px-3 py-1.5 border border-border dark:border-neutral-600 text-text dark:text-neutral-100 hover:bg-zinc-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
          >
            Premios ganados
          </Link>
        </div>
      </div>

      {/* Sync */}
      <SyncButton onSyncComplete={() => void reload()} />

      {/* Últimas importaciones */}
      {imports.length > 0 && (
        <div className="bg-surface dark:bg-neutral-800 border border-border dark:border-neutral-700 rounded-xl p-4 space-y-2">
          <h2 className="text-sm font-semibold text-text dark:text-neutral-100">Últimas importaciones</h2>
          <div className="space-y-1.5">
            {imports.map(imp => (
              <div key={imp.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted">{formatPeriodo(imp.periodo)}</span>
                <span className={`font-medium ${
                  imp.status === 'completed' ? 'text-emerald-600 dark:text-emerald-400' :
                  imp.status === 'completed_with_warnings' ? 'text-amber-600 dark:text-amber-400' :
                  imp.status === 'running' ? 'text-blue-600 dark:text-blue-400' :
                  'text-red-600 dark:text-red-400'
                }`}>
                  {imp.status.replace(/_/g, ' ')}
                </span>
                <span className="text-muted">{imp.rows_processed} filas · {imp.unmatched_count} no vinculadas</span>
                <span className="text-muted">
                  {new Date(imp.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dashboard global */}
      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-zinc-100 dark:bg-neutral-800 rounded-xl animate-pulse" />)}
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!loading && !error && entries.length === 0 && (
        <p className="text-center text-sm text-muted py-12">Sin datos para {formatPeriodo(periodo)}.</p>
      )}

      {!loading && !error && uniqueCampaignIds.map(cid => {
        const campaign = campaignMap[cid]
        if (!campaign) return null
        const campEntries = entries.filter(e => e.campaign_id === cid)

        return (
          <div key={cid} className="bg-surface dark:bg-neutral-800 border border-border dark:border-neutral-700 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border dark:border-neutral-700">
              {campaign.color && <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: campaign.color }} />}
              <h2 className="text-sm font-semibold text-text dark:text-neutral-100">{campaign.name}</h2>
              <span className="ml-auto text-xs text-muted">{campEntries.length} participantes</span>
              <Link
                to={`/indicadores/config/niveles/${cid}`}
                className="text-xs text-primary hover:underline"
              >
                Niveles
              </Link>
            </div>
            <div className="divide-y divide-border dark:divide-neutral-700">
              {campEntries
                .sort((a, b) => b.value - a.value)
                .map(e => (
                  <div key={e.snapshot_id} className="flex items-center gap-3 px-4 py-2">
                    {e.ranking_position && (
                      <span className="text-xs text-muted font-mono w-6 shrink-0">#{e.ranking_position}</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-text dark:text-neutral-100 truncate">{e.display_name}</span>
                        <span className="text-muted shrink-0 ml-2">
                          {formatValue(e.value, campaign.unit_label)} · {getCurrentLevelLabel(e)}
                        </span>
                      </div>
                      <CampaignProgressBar percent={getProgressPercent(e)} color={campaign.color ?? '#3B82F6'} />
                    </div>
                    {e.award_status && <CampaignRewardBadge status={e.award_status} />}
                  </div>
                ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
