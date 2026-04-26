import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useCampaignLevels } from '../hooks/useCampaignLevels'
import { useCampaignsConfig } from '../hooks/useCampaignsConfig'
import type { CampaignLevel, WinConditionType } from '../domain/types'

const EMPTY_LEVEL: Omit<CampaignLevel, 'id' | 'created_at' | 'updated_at'> = {
  campaign_id: '',
  track_id: null,
  name: '',
  level_order: 1,
  target_value: 0,
  badge_label: null,
  color: null,
  is_active: true,
  reward_title: null,
  reward_description: null,
  reward_image_url: null,
  reward_terms: null,
  reward_estimated_value: null,
  reward_is_active: true,
  evaluation_period_type: 'monthly',
  period_label: null,
  win_condition_type: 'threshold',
  required_rank: null,
  ranking_scope: null,
  tie_breaker_metric: null,
  target_month: null,
  requires_monthly_minimum: false,
  monthly_minimum_description: null,
  requires_active_group: false,
  requires_inforce_ratio: false,
  minimum_inforce_ratio: null,
  requires_limra_index: false,
  can_recover_previous_rewards: false,
  recovery_scope: null,
  validation_notes: null,
}

export function CampaignLevelsPage() {
  const { campaignId } = useParams<{ campaignId: string }>()
  const { campaigns } = useCampaignsConfig()
  const { levels, tracks, loading, error, createLvl, updateLvl } = useCampaignLevels(campaignId ?? '')

  const campaign = campaigns.find(c => c.id === campaignId)

  const [editing, setEditing] = useState<Partial<CampaignLevel> | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const openNew = () =>
    setEditing({ ...EMPTY_LEVEL, campaign_id: campaignId ?? '', level_order: levels.length + 1 })
  const openEdit = (l: CampaignLevel) => setEditing({ ...l })
  const closeForm = () => { setEditing(null); setSaveError(null) }

  const field = <K extends keyof CampaignLevel>(key: K, value: CampaignLevel[K]) => {
    setEditing(prev => prev ? { ...prev, [key]: value } : prev)
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    setSaveError(null)
    try {
      if (editing.id) {
        await updateLvl(editing.id, editing)
      } else {
        await createLvl(editing as Omit<CampaignLevel, 'id' | 'created_at' | 'updated_at'>)
      }
      closeForm()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  if (!campaignId) return <p className="p-6 text-sm text-muted">Campaña no encontrada.</p>

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/indicadores/config" className="text-sm text-muted hover:text-text dark:hover:text-neutral-100 transition-colors">
          ← Campañas
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-text dark:text-neutral-100">
            {campaign?.name ?? 'Campaña'}
          </h1>
          <p className="text-sm text-muted">Niveles y metas</p>
        </div>
        <button
          onClick={openNew}
          className="text-sm px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          + Nuevo nivel
        </button>
      </div>

      {/* Tracks */}
      {tracks.length > 0 && (
        <div className="flex gap-2 flex-wrap text-xs">
          <span className="text-muted font-medium">Caminos:</span>
          {tracks.map(t => (
            <span key={t.id} className={`px-2 py-0.5 rounded-full border ${t.is_active ? 'border-primary/30 bg-primary/5 text-primary' : 'border-border text-muted'}`}>
              {t.name}
            </span>
          ))}
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-zinc-100 dark:bg-neutral-800 rounded-xl animate-pulse" />)}
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {/* Lista de niveles */}
      {!loading && (
        <div className="space-y-2">
          {levels.map(l => {
            const trackName = l.track_id ? tracks.find(t => t.id === l.track_id)?.name : null
            return (
              <div
                key={l.id}
                className="flex items-center gap-3 p-3 bg-surface dark:bg-neutral-800 border border-border dark:border-neutral-700 rounded-xl"
              >
                <span className="text-xs font-mono text-muted w-6 shrink-0">{l.level_order}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text dark:text-neutral-100">{l.name}</span>
                    {!l.is_active && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-neutral-700 text-muted">inactivo</span>
                    )}
                    {trackName && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">{trackName}</span>
                    )}
                  </div>
                  <span className="text-xs text-muted">
                    Meta: {l.target_value} {campaign?.unit_label}
                    {l.reward_title && ` · Premio: ${l.reward_title}`}
                    {l.target_month && ` · Mes ${l.target_month}`}
                  </span>
                </div>
                <button
                  onClick={() => openEdit(l)}
                  className="text-xs text-muted hover:text-text dark:hover:text-neutral-100 shrink-0"
                >
                  Editar
                </button>
              </div>
            )
          })}
          {levels.length === 0 && (
            <p className="text-sm text-center text-muted py-8">No hay niveles configurados.</p>
          )}
        </div>
      )}

      {/* Modal de edición */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 dark:bg-black/60 px-4">
          <div className="w-full max-w-lg bg-white dark:bg-neutral-900 border border-border dark:border-neutral-700 rounded-2xl p-5 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-text dark:text-neutral-100">
                {editing.id ? 'Editar nivel' : 'Nuevo nivel'}
              </h2>
              <button onClick={closeForm} className="text-muted hover:text-text dark:hover:text-neutral-100 text-sm">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-muted mb-1">Nombre *</label>
                <input
                  type="text"
                  value={editing.name ?? ''}
                  onChange={e => field('name', e.target.value)}
                  className="w-full text-sm px-3 py-1.5 border border-border dark:border-neutral-600 rounded-lg bg-transparent dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {tracks.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Camino</label>
                  <select
                    value={editing.track_id ?? ''}
                    onChange={e => field('track_id', e.target.value || null)}
                    className="w-full text-sm px-3 py-1.5 border border-border dark:border-neutral-600 rounded-lg bg-transparent dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">Sin camino</option>
                    {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-muted mb-1">Orden</label>
                <input
                  type="number"
                  value={editing.level_order ?? 1}
                  onChange={e => field('level_order', parseInt(e.target.value, 10))}
                  className="w-full text-sm px-3 py-1.5 border border-border dark:border-neutral-600 rounded-lg bg-transparent dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">Meta *</label>
                <input
                  type="number"
                  value={editing.target_value ?? 0}
                  onChange={e => field('target_value', parseFloat(e.target.value))}
                  className="w-full text-sm px-3 py-1.5 border border-border dark:border-neutral-600 rounded-lg bg-transparent dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">Condición</label>
                <select
                  value={editing.win_condition_type ?? 'threshold'}
                  onChange={e => field('win_condition_type', e.target.value as WinConditionType)}
                  className="w-full text-sm px-3 py-1.5 border border-border dark:border-neutral-600 rounded-lg bg-transparent dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="threshold">Meta numérica</option>
                  <option value="ranking_position">Por ranking</option>
                  <option value="hybrid">Híbrido</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-1">Mes objetivo (carrera)</label>
                <input
                  type="number"
                  value={editing.target_month ?? ''}
                  onChange={e => field('target_month', e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="w-full text-sm px-3 py-1.5 border border-border dark:border-neutral-600 rounded-lg bg-transparent dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="ej. 3"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-medium text-muted mb-1">Premio</label>
                <input
                  type="text"
                  value={editing.reward_title ?? ''}
                  onChange={e => field('reward_title', e.target.value || null)}
                  className="w-full text-sm px-3 py-1.5 border border-border dark:border-neutral-600 rounded-lg bg-transparent dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Nombre del premio"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-medium text-muted mb-1">Descripción del premio</label>
                <textarea
                  value={editing.reward_description ?? ''}
                  onChange={e => field('reward_description', e.target.value || null)}
                  rows={2}
                  className="w-full text-sm px-3 py-1.5 border border-border dark:border-neutral-600 rounded-lg bg-transparent dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-medium text-muted mb-1">Notas de validación</label>
                <textarea
                  value={editing.validation_notes ?? ''}
                  onChange={e => field('validation_notes', e.target.value || null)}
                  rows={2}
                  className="w-full text-sm px-3 py-1.5 border border-border dark:border-neutral-600 rounded-lg bg-transparent dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <div className="col-span-2 flex flex-wrap gap-4">
                {[
                  { key: 'is_active' as const, label: 'Nivel activo' },
                  { key: 'reward_is_active' as const, label: 'Premio activo' },
                  { key: 'requires_monthly_minimum' as const, label: 'Mínimo mensual' },
                  { key: 'requires_active_group' as const, label: 'Grupo activo' },
                  { key: 'requires_inforce_ratio' as const, label: 'Ratio inforce' },
                  { key: 'requires_limra_index' as const, label: 'Índice LIMRA' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!(editing[key])}
                      onChange={e => field(key, e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-xs text-text dark:text-neutral-100">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {saveError && <p className="text-xs text-red-600 dark:text-red-400">{saveError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={closeForm} className="text-sm px-4 py-2 border border-border dark:border-neutral-600 rounded-lg text-text dark:text-neutral-100 hover:bg-zinc-100 dark:hover:bg-neutral-700">
                Cancelar
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving || !editing.name || !editing.target_value}
                className="text-sm px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
