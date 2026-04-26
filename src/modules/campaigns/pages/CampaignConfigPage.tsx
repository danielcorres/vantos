import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCampaignsConfig } from '../hooks/useCampaignsConfig'
import { getCampaignTypeLabel } from '../utils/campaignProgress'
import type { Campaign, CampaignType } from '../domain/types'

const EMPTY_CAMPAIGN: Omit<Campaign, 'id' | 'created_at' | 'updated_at'> = {
  slug: '',
  name: '',
  description: null,
  metric_type: 'polizas',
  unit_label: 'pólizas',
  color: '#3B82F6',
  sort_order: 0,
  is_active: true,
  starts_at: null,
  ends_at: null,
  campaign_type: 'monthly',
  duration_months: null,
  eligibility_basis: null,
  rules_summary: null,
  eligibility_rules_summary: null,
  rewards_are_cumulative: true,
  max_rewards_per_period: null,
}

export function CampaignConfigPage() {
  const { campaigns, loading, error, create, update } = useCampaignsConfig()
  const [editing, setEditing] = useState<Partial<Campaign> | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const TYPES: CampaignType[] = ['monthly', 'new_advisor_path', 'multi_track', 'ranking']

  const openNew = () => setEditing({ ...EMPTY_CAMPAIGN })
  const openEdit = (c: Campaign) => setEditing({ ...c })
  const closeForm = () => { setEditing(null); setSaveError(null) }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    setSaveError(null)
    try {
      if (editing.id) {
        await update(editing.id, editing)
      } else {
        await create(editing as Omit<Campaign, 'id' | 'created_at' | 'updated_at'>)
      }
      closeForm()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const field = <K extends keyof Campaign>(key: K, value: Campaign[K]) => {
    setEditing(prev => prev ? { ...prev, [key]: value } : prev)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-text dark:text-neutral-100">Configuración de Campañas</h1>
          <p className="text-sm text-muted">Gestiona las campañas activas en Vant.</p>
        </div>
        <button
          onClick={openNew}
          className="text-sm px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          + Nueva campaña
        </button>
      </div>

      {loading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <div key={i} className="h-14 bg-zinc-100 dark:bg-neutral-800 rounded-xl animate-pulse" />)}
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {/* Lista de campañas */}
      {!loading && (
        <div className="space-y-2">
          {campaigns.map(c => (
            <div
              key={c.id}
              className="flex items-center gap-3 p-3 bg-surface dark:bg-neutral-800 border border-border dark:border-neutral-700 rounded-xl"
            >
              {c.color && <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text dark:text-neutral-100">{c.name}</span>
                  {!c.is_active && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-neutral-700 text-muted">inactiva</span>
                  )}
                </div>
                <span className="text-xs text-muted">{getCampaignTypeLabel(c.campaign_type)} · {c.metric_type}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to={`/indicadores/config/niveles/${c.id}`}
                  className="text-xs text-primary hover:underline"
                >
                  Niveles
                </Link>
                <button
                  onClick={() => openEdit(c)}
                  className="text-xs text-muted hover:text-text dark:hover:text-neutral-100 transition-colors"
                >
                  Editar
                </button>
              </div>
            </div>
          ))}
          {campaigns.length === 0 && (
            <p className="text-sm text-center text-muted py-8">No hay campañas configuradas.</p>
          )}
        </div>
      )}

      {/* Modal / panel de edición */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 dark:bg-black/60 px-4">
          <div className="w-full max-w-lg bg-white dark:bg-neutral-900 border border-border dark:border-neutral-700 rounded-2xl p-5 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-text dark:text-neutral-100">
                {editing.id ? 'Editar campaña' : 'Nueva campaña'}
              </h2>
              <button onClick={closeForm} className="text-muted hover:text-text dark:hover:text-neutral-100 text-sm">✕</button>
            </div>

            <div className="space-y-3">
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
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Slug *</label>
                  <input
                    type="text"
                    value={editing.slug ?? ''}
                    onChange={e => field('slug', e.target.value.toLowerCase().replace(/\s/g, '_'))}
                    className="w-full text-sm px-3 py-1.5 border border-border dark:border-neutral-600 rounded-lg bg-transparent dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={editing.color ?? '#3B82F6'}
                      onChange={e => field('color', e.target.value)}
                      className="h-8 w-12 cursor-pointer rounded border-0"
                    />
                    <span className="text-xs text-muted">{editing.color}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Tipo</label>
                  <select
                    value={editing.campaign_type ?? 'monthly'}
                    onChange={e => field('campaign_type', e.target.value as CampaignType)}
                    className="w-full text-sm px-3 py-1.5 border border-border dark:border-neutral-600 rounded-lg bg-transparent dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {TYPES.map(t => (
                      <option key={t} value={t}>{getCampaignTypeLabel(t)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Tipo de métrica</label>
                  <input
                    type="text"
                    value={editing.metric_type ?? ''}
                    onChange={e => field('metric_type', e.target.value)}
                    className="w-full text-sm px-3 py-1.5 border border-border dark:border-neutral-600 rounded-lg bg-transparent dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="polizas"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Etiqueta de unidad</label>
                  <input
                    type="text"
                    value={editing.unit_label ?? ''}
                    onChange={e => field('unit_label', e.target.value)}
                    className="w-full text-sm px-3 py-1.5 border border-border dark:border-neutral-600 rounded-lg bg-transparent dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="pólizas"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Orden</label>
                  <input
                    type="number"
                    value={editing.sort_order ?? 0}
                    onChange={e => field('sort_order', parseInt(e.target.value, 10))}
                    className="w-full text-sm px-3 py-1.5 border border-border dark:border-neutral-600 rounded-lg bg-transparent dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-muted mb-1">Descripción</label>
                  <textarea
                    value={editing.description ?? ''}
                    onChange={e => field('description', e.target.value || null)}
                    rows={2}
                    className="w-full text-sm px-3 py-1.5 border border-border dark:border-neutral-600 rounded-lg bg-transparent dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-muted mb-1">Bases / reglas</label>
                  <textarea
                    value={editing.rules_summary ?? ''}
                    onChange={e => field('rules_summary', e.target.value || null)}
                    rows={2}
                    className="w-full text-sm px-3 py-1.5 border border-border dark:border-neutral-600 rounded-lg bg-transparent dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
                <div className="col-span-2 flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editing.is_active ?? true}
                      onChange={e => field('is_active', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-text dark:text-neutral-100">Campaña activa</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editing.rewards_are_cumulative ?? true}
                      onChange={e => field('rewards_are_cumulative', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm text-text dark:text-neutral-100">Premios acumulativos</span>
                  </label>
                </div>
              </div>
            </div>

            {saveError && <p className="text-xs text-red-600 dark:text-red-400">{saveError}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={closeForm}
                className="text-sm px-4 py-2 border border-border dark:border-neutral-600 rounded-lg text-text dark:text-neutral-100 hover:bg-zinc-100 dark:hover:bg-neutral-700"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving || !editing.name || !editing.slug}
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
