import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { pipelineApi } from '../features/pipeline/pipeline.api'
import { generateIdempotencyKey } from '../features/pipeline/pipeline.store'
import { todayLocalYmd, addDaysYmd, daysBetweenYmd } from '../shared/utils/dates'
import { useReducedMotion } from '../shared/hooks/useReducedMotion'

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

type NextFollowUpStatus = 'overdue' | 'today' | 'upcoming' | 'none'
function getNextFollowUpStatus(nextYmd: string | null): NextFollowUpStatus {
  if (!nextYmd || !nextYmd.trim()) return 'none'
  const today = todayLocalYmd()
  const d = daysBetweenYmd(today, nextYmd)
  if (d < 0) return 'overdue'
  if (d === 0) return 'today'
  return 'upcoming'
}

function humanizeNextFollowUp(nextYmd: string | null): string {
  if (!nextYmd || !nextYmd.trim()) return 'Sin fecha'
  const today = todayLocalYmd()
  const d = daysBetweenYmd(today, nextYmd)
  if (d < 0) return `Venció hace ${-d} día${-d !== 1 ? 's' : ''}`
  if (d === 0) return 'Hoy'
  if (d === 1) return 'Mañana'
  try {
    const [y, m, day] = nextYmd.split('-').map(Number)
    const date = new Date(y, m - 1, day)
    return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
  } catch {
    return nextYmd
  }
}

function phoneDigits(phone: string): string {
  return (phone || '').replace(/\D/g, '')
}

/** Número para wa.me en MX: 10 dígitos -> "52"+digits; ya con 52 y 12–13 dígitos -> as-is; <10 -> "" */
function normalizeWhatsAppNumber(digits: string): string {
  if (digits.length < 10) return ''
  if (digits.length === 10) return '52' + digits
  if (digits.startsWith('52') && digits.length >= 12 && digits.length <= 13) return digits
  return ''
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
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  // Reduced motion
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (id) {
      loadData()
    }
  }, [id])

  // Initialize form when lead loads; do not overwrite selectedStageId while moving
  useEffect(() => {
    if (lead) {
      setFullName(lead.full_name || '')
      setPhone(lead.phone || '')
      setEmail(lead.email || '')
      setSource(lead.source || '')
      setNotes(lead.notes || '')
      setLastContactAt(lead.last_contact_at ? lead.last_contact_at.split('T')[0] : '')
      setNextFollowUpAt(lead.next_follow_up_at ? lead.next_follow_up_at.split('T')[0] : '')
      if (!moving) setSelectedStageId(lead.stage_id)
    }
  }, [lead, moving])

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
    setToast(null)

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

      await loadData()
      setToast({ kind: 'success', text: 'Guardado' })
      setTimeout(() => setToast(null), 2000)
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
      setToast({ kind: 'success', text: 'Contacto registrado ✅' })
      setTimeout(() => setToast(null), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar contacto')
    } finally {
      setMarkingContact(false)
    }
  }

  const handleMoveStage = async (targetStageId?: string) => {
    const stageId = targetStageId ?? selectedStageId
    if (!id || !lead || !stageId) return
    if (stageId === lead.stage_id) return

    setMoving(true)
    setError(null)
    setToast(null)

    try {
      const idempotencyKey = generateIdempotencyKey(id, lead.stage_id, stageId)
      await pipelineApi.moveLeadStage(id, stageId, idempotencyKey)
      await loadData()
      setToast({ kind: 'success', text: 'Etapa actualizada' })
      setTimeout(() => setToast(null), 2000)
    } catch (err) {
      setSelectedStageId(lead.stage_id)
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

  const nextYmd = lead.next_follow_up_at ? lead.next_follow_up_at.split('T')[0] : null
  const followUpStatus = getNextFollowUpStatus(nextYmd)
  const waNumber = normalizeWhatsAppNumber(phoneDigits(lead.phone || ''))

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
        <div className="flex flex-col gap-2">
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
          {/* Línea compacta: phone+Copy, email, próximo seguimiento + acciones rápidas */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {lead.phone && (
              <span className="flex items-center gap-1">
                <span>{lead.phone}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(lead.phone || '')
                    setToast({ kind: 'success', text: 'Teléfono copiado' })
                    setTimeout(() => setToast(null), 2000)
                  }}
                  className="btn btn-ghost px-1.5 py-1 text-xs"
                  aria-label="Copiar teléfono"
                >
                  Copiar
                </button>
              </span>
            )}
            {lead.email && <span>{lead.email}</span>}
            <span className="text-muted">
              Próximo seguimiento: {humanizeNextFollowUp(nextYmd)}
            </span>
            {(waNumber || lead.email) && (
              <span className="flex items-center gap-1">
                {waNumber ? (
                  <a
                    href={`https://wa.me/${waNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost px-2 py-1 text-xs"
                  >
                    WhatsApp
                  </a>
                ) : null}
                {lead.email && (
                  <a
                    href={`mailto:${lead.email}`}
                    className="btn btn-ghost px-2 py-1 text-xs"
                  >
                    Email
                  </a>
                )}
              </span>
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

      {/* Toast */}
      {toast && (
        <div className="py-2 px-3 text-sm text-muted border border-border rounded-lg bg-bg mb-4" role="status">
          {toast.text}
        </div>
      )}

      {/* Grid: mobile = 1 col (Seguimiento, Etapa, Datos, Información, Actividad); desktop = 2 cols */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 1. Seguimiento — primera card del main */}
        <div
          className="card lg:col-span-8"
          style={{
            padding: '16px',
            borderLeft: '3px solid var(--primary)',
            transition: prefersReducedMotion ? 'none' : 'all 200ms ease-out',
          }}
        >
          <div className="flex flex-wrap items-center gap-2 justify-between mb-3">
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
              Seguimiento
            </h3>
            {followUpStatus !== 'none' && (
              <span
                className={
                  followUpStatus === 'overdue'
                    ? 'px-2 py-0.5 text-xs rounded bg-danger/15 text-danger'
                    : followUpStatus === 'today'
                      ? 'px-2 py-0.5 text-xs rounded bg-warning/15 text-warning'
                      : 'px-2 py-0.5 text-xs rounded bg-black/5 text-muted'
                }
              >
                {followUpStatus === 'overdue' && 'Vencido'}
                {followUpStatus === 'today' && 'Hoy'}
                {followUpStatus === 'upcoming' && 'Próximo'}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
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
          </div>
        </div>

        {/* 2. Etapa — sidebar */}
        <div
          className="card lg:col-span-4 lg:sticky lg:top-4 self-start"
          style={{
            padding: '16px',
            transition: prefersReducedMotion ? 'none' : 'all 150ms ease-out',
          }}
        >
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: 'var(--muted)' }}>
            Etapa
          </h3>
          {moving && (
            <p className="text-xs text-muted mb-2">Guardando…</p>
          )}
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
              Etapa
            </label>
            <select
              id="stage_select"
              value={selectedStageId}
              onChange={(e) => {
                const v = e.target.value
                setSelectedStageId(v)
                if (v && v !== lead.stage_id) handleMoveStage(v)
              }}
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
          <div className="my-3 h-px bg-black/5" />
          <div className="text-xs text-muted flex flex-col gap-1">
            <div>Creado: {formatDateTime(lead.created_at)}</div>
            <div>Actualizado: {formatDateTime(lead.updated_at)}</div>
            {lead.stage_changed_at && (
              <div>Cambio de etapa: {formatDateTime(lead.stage_changed_at)}</div>
            )}
          </div>
        </div>

        {/* 3. Datos / Notas */}
        <div
          className="card lg:col-span-8"
          style={{
            padding: '16px',
            transition: prefersReducedMotion ? 'none' : 'all 150ms ease-out',
          }}
        >
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: 'var(--muted)' }}>
            Datos
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label htmlFor="full_name" style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>
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
              <label htmlFor="phone" style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>
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
              <label htmlFor="email" style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>
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
              <label htmlFor="source" style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>
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
              <label htmlFor="notes" style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>
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

        {/* 4. Actividad — main */}
        <div className="card lg:col-span-8" style={{ padding: '16px' }}>
          <h3 style={{ margin: '0 0 14px 0', fontSize: '16px', fontWeight: 600 }}>
            Actividad
          </h3>
          <p className="muted" style={{ fontSize: '13px' }}>
            TODO: Conectar a activity_events filtrando por lead_id
          </p>
        </div>
      </div>
    </div>
  )
}
