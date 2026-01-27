import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { pipelineApi } from '../features/pipeline/pipeline.api'
import { generateIdempotencyKey } from '../features/pipeline/pipeline.store'
import { todayLocalYmd, addDaysYmd } from '../shared/utils/dates'

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
  last_contact_at: string | null
  next_follow_up_at: string | null
}

const SOURCE_OPTIONS = [
  { value: 'Referido', label: 'Referido' },
  { value: 'Mercado natural', label: 'Mercado natural' },
  { value: 'Frío', label: 'Frío' },
  { value: 'Social media', label: 'Social media' },
] as const

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
  const [searchParams] = useSearchParams()

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
  const [lastContactAt, setLastContactAt] = useState('')
  const [nextFollowUpAt, setNextFollowUpAt] = useState('')

  // Stage change state
  const [selectedStageId, setSelectedStageId] = useState<string>('')

  // Action states
  const [saving, setSaving] = useState(false)
  const [moving, setMoving] = useState(false)
  const [markingContact, setMarkingContact] = useState(false)
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
      setLastContactAt(lead.last_contact_at ? lead.last_contact_at.split('T')[0] : '')
      setNextFollowUpAt(lead.next_follow_up_at ? lead.next_follow_up_at.split('T')[0] : '')
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
            'id,full_name,phone,email,source,notes,stage_id,stage_changed_at,created_at,updated_at,last_contact_at,next_follow_up_at'
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
    const leadLastContact = lead.last_contact_at ? lead.last_contact_at.split('T')[0] : ''
    const leadNextFollowUp = lead.next_follow_up_at ? lead.next_follow_up_at.split('T')[0] : ''
    return (
      fullName !== (lead.full_name || '') ||
      phone !== (lead.phone || '') ||
      email !== (lead.email || '') ||
      source !== (lead.source || '') ||
      notes !== (lead.notes || '') ||
      lastContactAt !== leadLastContact ||
      nextFollowUpAt !== leadNextFollowUp
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
      await pipelineApi.updateLead(id, {
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        source: source.trim() || null,
        notes: notes.trim() || null,
        last_contact_at: lastContactAt || null,
        next_follow_up_at: nextFollowUpAt || null,
      })

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

  const handleMarkContact = async () => {
    if (!id) return

    setMarkingContact(true)
    setError(null)

    try {
      const today = todayLocalYmd()
      const nextFollowUp = addDaysYmd(today, 2) // +2 días por defecto

      await pipelineApi.updateLead(id, {
        last_contact_at: today,
        next_follow_up_at: nextFollowUp,
      })

      // Refetch lead
      await loadData()

      setSaveMessage('Contacto registrado ✅')
      setTimeout(() => setSaveMessage(null), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar contacto')
    } finally {
      setMarkingContact(false)
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
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1 className="text-2xl font-bold mb-2">
            {lead.full_name || 'Lead sin nombre'}
          </h1>
          <div className="flex gap-2 flex-wrap">
            {lead.source && (
              <span className="px-2 py-0.5 text-xs bg-black/5 rounded text-muted">{lead.source}</span>
            )}
            {currentStage && (
              <span className="px-2 py-0.5 text-xs bg-black/5 rounded text-muted">{currentStage.name}</span>
            )}
          </div>
        </div>
        <div className="row" style={{ gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              const pipelineUrl = searchParams.get('weekStart')
                ? `/pipeline?lead=${lead.id}&weekStart=${searchParams.get('weekStart')}`
                : `/pipeline?lead=${lead.id}`
              navigate(pipelineUrl)
            }}
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
      <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: 'var(--muted)' }}>
          Datos
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
            <select
              id="source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              disabled={saving}
              style={{
                width: '100%',
                fontFamily: 'inherit',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '8px 12px',
              }}
            >
              <option value="">Seleccionar fuente</option>
              {SOURCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
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

        </div>
      </div>

      {/* Seguimiento Section - Moved up for prominence */}
      <div className="card" style={{ marginBottom: '16px', padding: '16px', borderLeft: '3px solid var(--primary)' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', fontWeight: '600' }}>
          Seguimiento
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label
              htmlFor="next_follow_up_at"
              style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '13px',
                fontWeight: '500',
              }}
            >
              Próximo seguimiento
            </label>
            <input
              id="next_follow_up_at"
              type="date"
              value={nextFollowUpAt}
              onChange={(e) => setNextFollowUpAt(e.target.value)}
              disabled={saving}
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
              htmlFor="last_contact_at"
              style={{
                display: 'block',
                marginBottom: '4px',
                fontSize: '13px',
                fontWeight: '500',
              }}
            >
              Último contacto
            </label>
            <input
              id="last_contact_at"
              type="date"
              value={lastContactAt}
              onChange={(e) => setLastContactAt(e.target.value)}
              disabled={saving}
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
              onClick={handleMarkContact}
              disabled={markingContact || saving}
              className="btn btn-primary"
              style={{ fontSize: '13px' }}
            >
              {markingContact ? 'Registrando...' : 'Marcar contacto hoy'}
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges() || saving || markingContact}
              className="btn btn-primary"
              style={{ fontSize: '13px' }}
            >
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>

      {/* Etapa Section */}
      <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: 'var(--muted)' }}>
          Etapa
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
      <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: 'var(--muted)' }}>
          Información
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
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
