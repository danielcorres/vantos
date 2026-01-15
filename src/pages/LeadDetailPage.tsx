import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { pipelineApi } from '../features/pipeline/pipeline.api'
import { generateIdempotencyKey } from '../features/pipeline/pipeline.store'

type LeadData = {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  source: string | null
  notes: string | null
  stage_id: string
  stage_changed_at: string | null
  created_at: string
  updated_at: string
}

type Stage = {
  id: string
  name: string
  position: number
}

// Helper: Format date and time for display
function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    return date.toLocaleString('es-MX', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'N/A'
  }
}

// Helper: Validate email format
function isValidEmail(email: string): boolean {
  if (!email.trim()) return true // Empty is valid (optional field)
  return email.includes('@')
}

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [lead, setLead] = useState<LeadData | null>(null)
  const [stages, setStages] = useState<Stage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  // Form state
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [source, setSource] = useState('')
  const [notes, setNotes] = useState('')

  // Stage change state
  const [selectedStageId, setSelectedStageId] = useState<string>('')

  // Action states
  const [saving, setSaving] = useState(false)
  const [moving, setMoving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [moveMessage, setMoveMessage] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      loadData()
    }
  }, [id])

  // Initialize form when lead loads
  useEffect(() => {
    if (lead) {
      setFullName(lead.full_name || '')
      setPhone(lead.phone || '')
      setEmail(lead.email || '')
      setSource(lead.source || '')
      setNotes(lead.notes || '')
      setSelectedStageId(lead.stage_id)
    }
  }, [lead])

  const loadData = async () => {
    if (!id) return

    setLoading(true)
    setError(null)
    setNotFound(false)

    try {
      const [leadData, stagesData] = await Promise.all([
        supabase
          .from('leads')
          .select(
            'id,full_name,phone,email,source,notes,stage_id,stage_changed_at,created_at,updated_at'
          )
          .eq('id', id)
          .single(),
        supabase
          .from('pipeline_stages')
          .select('id,name,position')
          .order('position', { ascending: true }),
      ])

      if (leadData.error) {
        if (leadData.error.code === 'PGRST116') {
          setNotFound(true)
        } else {
          throw leadData.error
        }
        return
      }

      if (stagesData.error) throw stagesData.error

      setLead(leadData.data as LeadData)
      setStages(stagesData.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const hasChanges = (): boolean => {
    if (!lead) return false
    return (
      fullName !== (lead.full_name || '') ||
      phone !== (lead.phone || '') ||
      email !== (lead.email || '') ||
      source !== (lead.source || '') ||
      notes !== (lead.notes || '')
    )
  }

  const handleSave = async () => {
    if (!id || !lead) return

    // Validation
    if (!fullName.trim()) {
      setError('El nombre completo es requerido')
      return
    }

    if (email.trim() && !isValidEmail(email)) {
      setError('El email debe incluir @')
      return
    }

    setSaving(true)
    setError(null)
    setSaveMessage(null)

    try {
      const { error: updateError } = await supabase
        .from('leads')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          source: source.trim() || null,
          notes: notes.trim() || null,
        })
        .eq('id', id)

      if (updateError) throw updateError

      // Refetch lead
      await loadData()

      setSaveMessage('Guardado')
      setTimeout(() => setSaveMessage(null), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleMoveStage = async () => {
    if (!id || !lead || !selectedStageId) return

    if (selectedStageId === lead.stage_id) {
      setMoveMessage('El lead ya está en esta etapa')
      setTimeout(() => setMoveMessage(null), 2000)
      return
    }

    setMoving(true)
    setError(null)
    setMoveMessage(null)

    try {
      // Generate idempotency key
      const idempotencyKey = generateIdempotencyKey(
        id,
        lead.stage_id,
        selectedStageId
      )

      // Use pipeline.api.ts wrapper
      await pipelineApi.moveLeadStage(id, selectedStageId, idempotencyKey)

      // Refetch lead
      await loadData()

      setMoveMessage('Etapa actualizada')
      setTimeout(() => setMoveMessage(null), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al mover etapa')
    } finally {
      setMoving(false)
    }
  }

  const currentStage = stages.find((s) => s.id === lead?.stage_id)

  if (loading) {
    return (
      <div>
        <div className="row space-between" style={{ marginBottom: '24px' }}>
          <h2 className="title">Detalle del Lead</h2>
        </div>
        <div className="card" style={{ padding: '24px' }}>
          <div
            style={{
              height: '24px',
              background: 'var(--bg)',
              borderRadius: '8px',
              marginBottom: '16px',
            }}
          />
          <div
            style={{
              height: '200px',
              background: 'var(--bg)',
              borderRadius: '8px',
            }}
          />
        </div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div>
        <div className="row space-between" style={{ marginBottom: '24px' }}>
          <h2 className="title">Detalle del Lead</h2>
          <button onClick={() => navigate(-1)} className="btn btn-ghost">
            Volver
          </button>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ margin: '0 0 16px 0', fontSize: '16px' }}>
            Lead no encontrado
          </p>
          <p className="muted" style={{ margin: '0 0 24px 0' }}>
            El lead que buscas no existe o no tienes permisos para verlo.
          </p>
          <button onClick={() => navigate('/pipeline')} className="btn btn-primary">
            Ir al Pipeline
          </button>
        </div>
      </div>
    )
  }

  if (error && !lead) {
    return (
      <div>
        <div className="row space-between" style={{ marginBottom: '24px' }}>
          <h2 className="title">Detalle del Lead</h2>
          <button onClick={() => navigate(-1)} className="btn btn-ghost">
            Volver
          </button>
        </div>
        <div className="error-box">
          <p style={{ margin: '0 0 12px 0' }}>{error}</p>
          <button onClick={loadData} className="btn btn-primary">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!lead) {
    return null
  }

  return (
    <div>
      {/* Header */}
      <div
        className="row space-between"
        style={{
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <h2 className="title" style={{ margin: 0, fontSize: '18px' }}>
          {lead.full_name || 'Lead sin nombre'}
        </h2>
        <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate(`/pipeline?lead=${lead.id}`)}
            className="btn btn-ghost"
            style={{ fontSize: '13px' }}
          >
            Ver en pipeline
          </button>
          <button
            onClick={() => navigate(-1)}
            className="btn btn-ghost"
            style={{ fontSize: '13px' }}
          >
            Volver
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-box" style={{ marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Success Messages */}
      {saveMessage && (
        <div
          style={{
            background: '#efe',
            color: '#3c3',
            border: '1px solid #3c3',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
          }}
        >
          {saveMessage}
        </div>
      )}
      {moveMessage && (
        <div
          style={{
            background: '#efe',
            color: '#3c3',
            border: '1px solid #3c3',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
          }}
        >
          {moveMessage}
        </div>
      )}

      {/* Datos Section */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
          Datos
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label
              htmlFor="full_name"
              style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              Nombre completo *
            </label>
            <input
              id="full_name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              disabled={saving}
              style={{ width: '100%' }}
              required
            />
          </div>

          <div>
            <label
              htmlFor="phone"
              style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              Teléfono
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={saving}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label
              htmlFor="email"
              style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={saving}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label
              htmlFor="source"
              style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              Fuente
            </label>
            <input
              id="source"
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              disabled={saving}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label
              htmlFor="notes"
              style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              Notas
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={saving}
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

          <div className="row" style={{ gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              onClick={handleSave}
              disabled={!hasChanges() || saving}
              className="btn btn-primary"
              style={{ fontSize: '13px' }}
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>

      {/* Etapa Section */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600' }}>
          Etapa
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label
              style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              Etapa actual
            </label>
            <div
              style={{
                padding: '8px 12px',
                background: 'var(--bg)',
                borderRadius: '8px',
                fontSize: '14px',
              }}
            >
              {currentStage?.name || 'Sin etapa asignada'}
            </div>
          </div>

          <div>
            <label
              htmlFor="stage_select"
              style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '14px',
                fontWeight: '500',
              }}
            >
              Cambiar a etapa
            </label>
            <select
              id="stage_select"
              value={selectedStageId}
              onChange={(e) => setSelectedStageId(e.target.value)}
              disabled={moving || stages.length === 0}
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

          <div className="row" style={{ gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button
              onClick={handleMoveStage}
              disabled={
                !selectedStageId ||
                selectedStageId === lead.stage_id ||
                moving
              }
              className="btn btn-primary"
              style={{ fontSize: '13px' }}
            >
              {moving ? 'Moviendo...' : 'Mover etapa'}
            </button>
          </div>
        </div>
      </div>

      {/* Timestamps Section */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
        <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', fontWeight: '600' }}>
          Información
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
          <div>
            <span className="muted">Creado: </span>
            <span>{formatDateTime(lead.created_at)}</span>
          </div>
          <div>
            <span className="muted">Actualizado: </span>
            <span>{formatDateTime(lead.updated_at)}</span>
          </div>
          {lead.stage_changed_at && (
            <div>
              <span className="muted">Cambio de etapa: </span>
              <span>{formatDateTime(lead.stage_changed_at)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Actividad Section (Placeholder) */}
      <div className="card" style={{ padding: '16px' }}>
        <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', fontWeight: '600' }}>
          Actividad
        </h3>
        <p className="muted" style={{ fontSize: '13px' }}>
          TODO: Conectar a activity_events filtrando por lead_id
        </p>
      </div>
    </div>
  )
}
