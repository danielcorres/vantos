import { useState } from 'react'
import { useCampaignSync } from '../hooks/useCampaignSync'
import { formatPeriodo } from '../utils/campaignProgress'

interface SyncButtonProps {
  onSyncComplete?: () => void
}

export function SyncButton({ onSyncComplete }: SyncButtonProps) {
  const { syncing, lastResult, error, sync } = useCampaignSync()
  const [periodo, setPeriodo] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const handleSync = async () => {
    const result = await sync(periodo)
    if (result?.ok && onSyncComplete) {
      onSyncComplete()
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4 bg-surface dark:bg-neutral-800 border border-border dark:border-neutral-700 rounded-xl">
      <h3 className="text-sm font-semibold text-text dark:text-neutral-100">Sincronizar desde Google Sheets</h3>

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={periodo}
          onChange={e => setPeriodo(e.target.value)}
          placeholder="YYYY-MM"
          className="flex-1 text-sm px-3 py-1.5 border border-border dark:border-neutral-600 rounded-lg bg-transparent dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={() => void handleSync()}
          disabled={syncing || !periodo.trim()}
          className="px-4 py-1.5 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {syncing ? 'Sincronizando…' : 'Sincronizar'}
        </button>
      </div>

      {periodo && (
        <p className="text-xs text-muted">
          Periodo: <span className="font-medium">{formatPeriodo(periodo)}</span>
        </p>
      )}

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {lastResult && (
        <div className={`text-xs p-2 rounded-lg border ${
          lastResult.status === 'completed'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
            : lastResult.status === 'completed_with_warnings'
            ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
            : 'border-red-200 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300'
        }`}>
          <p className="font-medium capitalize">{lastResult.status.replace(/_/g, ' ')}</p>
          <p>Procesadas: {lastResult.rows_processed} · Insertadas: {lastResult.rows_inserted} · Actualizadas: {lastResult.rows_updated}</p>
          {lastResult.unmatched_count > 0 && (
            <p>No vinculadas: {lastResult.unmatched_count}</p>
          )}
        </div>
      )}
    </div>
  )
}
