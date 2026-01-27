import { useState, useEffect } from 'react'
import type { PipelineStage } from '../pipeline.api'
import { todayLocalYmd, addDaysYmd } from '../../../shared/utils/dates'

interface LeadCreateModalProps {
  stages: PipelineStage[]
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    full_name: string
    phone?: string
    email?: string
    source?: string
    notes?: string
    stage_id: string
    next_follow_up_at?: string
  }) => Promise<void>
}

const SOURCE_OPTIONS = [
  { value: 'Referido', label: 'Referido' },
  { value: 'Mercado natural', label: 'Mercado natural' },
  { value: 'Frío', label: 'Frío' },
  { value: 'Social media', label: 'Social media' },
] as const

export function LeadCreateModal({
  stages,
  isOpen,
  onClose,
  onSubmit,
}: LeadCreateModalProps) {
  const [fullName, setFullName] = useState('')
  const [source, setSource] = useState('')
  const [stageId, setStageId] = useState(stages[0]?.id || '')
  const [nextFollowUpAt, setNextFollowUpAt] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && stages.length > 0) {
      setStageId(stages[0].id)
      // Default: mañana
      const tomorrow = addDaysYmd(todayLocalYmd(), 1)
      setNextFollowUpAt(tomorrow)
    }
  }, [isOpen, stages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) {
      setError('El nombre es requerido')
      return
    }
    if (!source) {
      setError('La fuente es requerida')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onSubmit({
        full_name: fullName.trim(),
        source: source,
        notes: notes.trim() || undefined,
        stage_id: stageId,
        next_follow_up_at: nextFollowUpAt || undefined,
      })
      handleClose()
    } catch (err: any) {
      setError(err.message || 'Error al crear el lead')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFullName('')
    setSource('')
    setNotes('')
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
    >
      <div
        className="card w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Nuevo lead</h2>
          <button
            onClick={handleClose}
            className="btn btn-ghost text-sm px-2 py-1"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre */}
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-muted mb-1">
              Nombre *
            </label>
            <input
              id="full_name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={loading}
              className="w-full px-3 py-2 text-sm border border-border rounded bg-bg text-text"
              placeholder="Nombre completo"
            />
          </div>

          {/* Fuente */}
          <div>
            <label htmlFor="source" className="block text-sm font-medium text-muted mb-1">
              Fuente *
            </label>
            <select
              id="source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              required
              disabled={loading}
              className="w-full px-3 py-2 text-sm border border-border rounded bg-bg text-text"
            >
              <option value="">Seleccionar fuente</option>
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Etapa */}
          <div>
            <label htmlFor="stage_id" className="block text-sm font-medium text-muted mb-1">
              Etapa
            </label>
            <select
              id="stage_id"
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 text-sm border border-border rounded bg-bg text-text"
            >
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </div>

          {/* Próximo seguimiento */}
          <div>
            <label htmlFor="next_follow_up_at" className="block text-sm font-medium text-muted mb-1">
              Próximo seguimiento
            </label>
            <input
              id="next_follow_up_at"
              type="date"
              value={nextFollowUpAt}
              onChange={(e) => setNextFollowUpAt(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 text-sm border border-border rounded bg-bg text-text"
            />
          </div>

          {/* Nota rápida */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-muted mb-1">
              Nota rápida (opcional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-border rounded bg-bg text-text resize-none"
              placeholder="Nota breve..."
            />
          </div>

          {error && (
            <div className="card p-3 bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="btn btn-ghost text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary text-sm"
            >
              {loading ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
