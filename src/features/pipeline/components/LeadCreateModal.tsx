import { useState, useEffect } from 'react'
import type { PipelineStage } from '../pipeline.api'
import { useReducedMotion } from '../../../shared/hooks/useReducedMotion'

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
  }) => Promise<void>
  defaultStageId?: string
}

const SOURCE_OPTIONS = [
  { value: 'Referido', label: 'Referido' },
  { value: 'Mercado natural', label: 'Mercado natural' },
  { value: 'Frío', label: 'Frío' },
  { value: 'Social media', label: 'Social media' },
] as const

const DEFAULT_SOURCE = 'Referido'

export function LeadCreateModal({
  stages,
  isOpen,
  onClose,
  onSubmit,
  defaultStageId,
}: LeadCreateModalProps) {
  const [fullName, setFullName] = useState('')
  const [source, setSource] = useState(DEFAULT_SOURCE)
  const [stageId, setStageId] = useState(stages[0]?.id ?? '')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (isOpen && stages.length > 0) {
      const validDefault = defaultStageId && stages.some((s) => s.id === defaultStageId)
      setStageId(validDefault ? defaultStageId : (stages.find((s) => s.slug === 'contactos_nuevos')?.id ?? stages[0].id))
      setSource(DEFAULT_SOURCE)
    }
  }, [isOpen, stages, defaultStageId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) {
      setError('El nombre es requerido')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onSubmit({
        full_name: fullName.trim(),
        source: source || undefined,
        notes: notes.trim() || undefined,
        stage_id: stageId,
      })
      handleClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear el lead')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setFullName('')
    setSource(DEFAULT_SOURCE)
    setNotes('')
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleClose}
      style={{
        animation: prefersReducedMotion ? 'none' : 'fadeIn 150ms ease-out',
      }}
    >
      <div
        className="card w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          animation: prefersReducedMotion ? 'none' : 'slideUp 200ms ease-out',
        }}
      >
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border/50">
          <h2 className="text-lg font-semibold">Nuevo lead</h2>
          <button
            onClick={handleClose}
            className="btn btn-ghost text-sm px-2 py-1"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {/* Nombre */}
          <div>
            <label htmlFor="full_name" className="block text-xs font-medium text-muted mb-1">
              Nombre *
            </label>
            <input
              id="full_name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={loading}
              className="w-full px-2.5 py-1.5 text-sm border border-border rounded bg-bg text-text"
              placeholder="Nombre completo"
            />
          </div>

          {/* Fuente */}
          <div>
            <label htmlFor="source" className="block text-xs font-medium text-muted mb-1">
              Fuente
            </label>
            <select
              id="source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              disabled={loading}
              className="w-full px-2.5 py-1.5 text-sm border border-border rounded bg-bg text-text"
            >
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Etapa */}
          <div>
            <label htmlFor="stage_id" className="block text-xs font-medium text-muted mb-1">
              Etapa
            </label>
            <select
              id="stage_id"
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              disabled={loading}
              className="w-full px-2.5 py-1.5 text-sm border border-border rounded bg-bg text-text"
            >
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
            </select>
          </div>

          {/* Nota rápida */}
          <div>
            <label htmlFor="notes" className="block text-xs font-medium text-muted mb-1">
              Nota rápida (opcional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={loading}
              rows={2}
              className="w-full px-2.5 py-1.5 text-sm border border-border rounded bg-bg text-text resize-none"
              placeholder="Nota breve..."
            />
          </div>

          {error && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="btn btn-ghost text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary text-sm font-medium"
            >
              {loading ? 'Creando...' : 'Crear'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
