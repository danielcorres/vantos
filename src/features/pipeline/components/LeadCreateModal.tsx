import { useState, useEffect } from 'react'
import type { PipelineStage } from '../pipeline.api'

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
}

export function LeadCreateModal({
  stages,
  isOpen,
  onClose,
  onSubmit,
}: LeadCreateModalProps) {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [source, setSource] = useState('')
  const [notes, setNotes] = useState('')
  const [stageId, setStageId] = useState(stages[0]?.id || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && stages.length > 0) {
      setStageId(stages[0].id)
    }
  }, [isOpen, stages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim()) {
      setError('El nombre completo es requerido')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onSubmit({
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        source: source.trim() || undefined,
        notes: notes.trim() || undefined,
        stage_id: stageId,
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
    setPhone('')
    setEmail('')
    setSource('')
    setNotes('')
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={handleClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '500px',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row space-between" style={{ marginBottom: '20px' }}>
          <h2 className="title" style={{ fontSize: '20px' }}>Nuevo lead</h2>
          <button
            onClick={handleClose}
            className="btn btn-ghost"
            style={{ padding: '4px 8px' }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label
                htmlFor="full_name"
                style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}
              >
                Nombre completo *
              </label>
              <input
                id="full_name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={loading}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}
              >
                Teléfono
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label
                htmlFor="email"
                style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label
                htmlFor="source"
                style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}
              >
                Fuente
              </label>
              <input
                id="source"
                type="text"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                disabled={loading}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label
                htmlFor="notes"
                style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}
              >
                Notas
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={loading}
                rows={4}
                style={{
                  width: '100%',
                  fontFamily: 'inherit',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                }}
              />
            </div>

            <div>
              <label
                htmlFor="stage_id"
                style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}
              >
                Etapa
              </label>
              <select
                id="stage_id"
                value={stageId}
                onChange={(e) => setStageId(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  fontFamily: 'inherit',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                }}
              >
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="error-box">{error}</div>
            )}

            <div className="row" style={{ gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="btn btn-ghost"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
              >
                {loading ? 'Creando...' : 'Crear'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
