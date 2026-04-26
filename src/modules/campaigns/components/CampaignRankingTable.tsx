import { useState } from 'react'
import { fetchCampaignRanking } from '../data/campaigns.api'
import { formatValue } from '../utils/campaignProgress'
import type { RankingEntry } from '../domain/types'

interface CampaignRankingTableProps {
  periodo: string
  campaignId: string
  trackId?: string | null
  unitLabel?: string
}

export function CampaignRankingTable({
  periodo,
  campaignId,
  trackId,
  unitLabel,
}: CampaignRankingTableProps) {
  const [entries, setEntries] = useState<RankingEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCampaignRanking(periodo, campaignId, trackId)
      setEntries(data)
      setLoaded(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar ranking')
    } finally {
      setLoading(false)
    }
  }

  if (!loaded) {
    return (
      <button
        onClick={() => void load()}
        className="text-sm text-primary hover:underline"
        disabled={loading}
      >
        {loading ? 'Cargando ranking…' : 'Ver ranking'}
      </button>
    )
  }

  if (error) return <p className="text-sm text-red-500">{error}</p>

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border dark:border-neutral-700 text-left text-xs text-muted">
            <th className="pb-2 pr-3 font-medium">#</th>
            <th className="pb-2 pr-3 font-medium">Nombre</th>
            <th className="pb-2 text-right font-medium">{unitLabel ?? 'Valor'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border dark:divide-neutral-700">
          {entries.map(e => (
            <tr
              key={e.user_id}
              className={`${e.is_current_user ? 'bg-primary/5 dark:bg-white/5' : ''}`}
            >
              <td className="py-1.5 pr-3 text-muted font-mono">{e.rank_pos}</td>
              <td className={`py-1.5 pr-3 ${e.is_current_user ? 'font-semibold text-primary' : 'text-text dark:text-neutral-100'}`}>
                {e.display_name}
                {e.is_current_user && <span className="ml-1 text-xs">(tú)</span>}
              </td>
              <td className="py-1.5 text-right text-text dark:text-neutral-100">
                {e.value != null ? formatValue(e.value) : '–'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
