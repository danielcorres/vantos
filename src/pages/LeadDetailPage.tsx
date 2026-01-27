import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { pipelineApi, type LeadStageHistoryRow } from '../features/pipeline/pipeline.api'
import { generateIdempotencyKey } from '../features/pipeline/pipeline.store'
import { todayLocalYmd, addDaysYmd, daysBetweenYmd, formatDateMX, diffDaysFloor, ymdToLocalNoonISO } from '../shared/utils/dates'
import { useReducedMotion } from '../shared/hooks/useReducedMotion'
import { useDirtyState } from '../shared/hooks/useDirtyState'
import { UnsavedChangesBar, UNSAVED_BAR_HEIGHT } from '../shared/components/UnsavedChangesBar'
import { getStageTagClasses, displayStageName } from '../shared/utils/stageStyles'

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
  archived_at: string | null
  archived_by: string | null
  archive_reason: string | null
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

const CHIP_BASE = 'inline-block px-2 py-0.5 text-xs rounded-md border border-black/5'

function getSourceTagClasses(source: string | null): string {
  if (!source) return `${CHIP_BASE} bg-black/5 text-muted`
  switch (source) {
    case 'Referido':
      return `${CHIP_BASE} bg-emerald-100 text-emerald-800`
    case 'Mercado natural':
      return `${CHIP_BASE} bg-sky-100 text-sky-800`
    case 'Frío':
      return `${CHIP_BASE} bg-rose-100 text-rose-800`
    case 'Social media':
      return `${CHIP_BASE} bg-violet-100 text-violet-800`
    default:
      return `${CHIP_BASE} bg-black/5 text-muted`
  }
}

/** Etapas que son hitos: requieren fecha real (occurred_at) al mover */
function isMilestoneStage(stageName: string): boolean {
  const n = stageName.trim()
  return (
    n === 'Cita realizada' ||
    n === 'Propuesta presentada' ||
    n === 'Propuesta' ||
    n === 'Cerrado/Ganado'
  )
}

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [lead, setLead] = useState<LeadData | null>(null)
  const [stages, setStages] = useState<Stage[]>([])
  const [stageHistory, setStageHistory] = useState<LeadStageHistoryRow[]>([])
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
  const [isEditingDatos, setIsEditingDatos] = useState(false)
  const [actividadExpanded, setActividadExpanded] = useState(false)
  // Modal fecha real (solo para etapas hito)
  const [pendingStageMove, setPendingStageMove] = useState<{ toStageId: string } | null>(null)
  const [occurredAtForModal, setOccurredAtForModal] = useState<string>(() => todayLocalYmd())
  // Archivar: modal + motivo
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [archiveReasonInput, setArchiveReasonInput] = useState('')
  // Dropdown Acciones (Archivar/Restaurar)
  const [actionsOpen, setActionsOpen] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)

  // Reduced motion
  const prefersReducedMotion = useReducedMotion()

  const originalSnapshot = useMemo(() => {
    if (!lead) return null
    return {
      full_name: lead.full_name || '',
      phone: lead.phone || '',
      email: lead.email || '',
      source: lead.source || '',
      notes: lead.notes || '',
      last_contact_at: lead.last_contact_at ? lead.last_contact_at.split('T')[0] : '',
      next_follow_up_at: lead.next_follow_up_at ? lead.next_follow_up_at.split('T')[0] : '',
    }
  }, [lead])
  const currentSnapshot = useMemo(
    () => ({
      full_name: fullName,
      phone,
      email,
      source,
      notes,
      last_contact_at: lastContactAt,
      next_follow_up_at: nextFollowUpAt,
    }),
    [fullName, phone, email, source, notes, lastContactAt, nextFollowUpAt]
  )
  // useDirtyState se ejecuta SIEMPRE (Rules of Hooks); la condición solo aplica al valor derivado
  const isDirty = useDirtyState(originalSnapshot, currentSnapshot)
  const dirty = lead != null && isDirty

  const stageNameById = useMemo(() => {
    const m = new Map<string, string>()
    stages.forEach((s) => m.set(s.id, s.name))
    return m
  }, [stages])

  const { citaRealizadaAt, propuestaAt, cierreAt, enteredCurrentStageAt } = useMemo(() => {
    const out = {
      citaRealizadaAt: null as string | null,
      propuestaAt: null as string | null,
      cierreAt: null as string | null,
      enteredCurrentStageAt: null as string | null,
    }
    if (!lead || !stageHistory.length) {
      if (lead) out.enteredCurrentStageAt = lead.created_at
      return out
    }
    for (const h of stageHistory) {
      const name = stageNameById.get(h.to_stage_id) ?? ''
      const when = h.occurred_at ?? h.moved_at
      if (name === 'Cita realizada' && !out.citaRealizadaAt) out.citaRealizadaAt = when
      if ((name === 'Propuesta presentada' || name === 'Propuesta') && !out.propuestaAt) out.propuestaAt = when
      if (name === 'Cerrado/Ganado' && !out.cierreAt) out.cierreAt = when
    }
    const currentEntries = stageHistory.filter((h) => h.to_stage_id === lead.stage_id)
    if (currentEntries.length) {
      const last = currentEntries[currentEntries.length - 1]
      out.enteredCurrentStageAt = last.occurred_at ?? last.moved_at
    } else {
      out.enteredCurrentStageAt = lead.created_at
    }
    return out
  }, [lead, stageHistory, stageNameById])

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
      const [leadData, stagesData, historyData] = await Promise.all([
        supabase
          .from('leads')
          .select(
            'id,full_name,phone,email,source,notes,stage_id,stage_changed_at,created_at,updated_at,last_contact_at,next_follow_up_at,archived_at,archived_by,archive_reason'
          )
          .eq('id', id)
          .single(),
        supabase
          .from('pipeline_stages')
          .select('id,name,position')
          .order('position', { ascending: true }),
        pipelineApi.getLeadStageHistory(id),
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
      setStageHistory(historyData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos')
    } finally {
      setLoading(false)
    }
  }

  const discardChanges = useCallback(() => {
    if (!lead) return
    setFullName(lead.full_name || '')
    setPhone(lead.phone || '')
    setEmail(lead.email || '')
    setSource(lead.source || '')
    setNotes(lead.notes || '')
    setLastContactAt(lead.last_contact_at ? lead.last_contact_at.split('T')[0] : '')
    setNextFollowUpAt(lead.next_follow_up_at ? lead.next_follow_up_at.split('T')[0] : '')
  }, [lead])

  const handleDiscard = useCallback(() => {
    discardChanges()
    setIsEditingDatos(false)
  }, [discardChanges])

  useEffect(() => {
    if (!isEditingDatos) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDiscard()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isEditingDatos, handleDiscard])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setActionsOpen(false)
      }
    }
    if (actionsOpen) {
      document.addEventListener('click', close)
      return () => document.removeEventListener('click', close)
    }
  }, [actionsOpen])

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
      setIsEditingDatos(false)
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
      const nextFollowUp = addDaysYmd(today, 2)

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

  const handleMoveStage = async (targetStageId?: string, occurredAt?: string | null) => {
    const stageId = targetStageId ?? selectedStageId
    if (!id || !lead || !stageId) return
    if (stageId === lead.stage_id) return

    setMoving(true)
    setError(null)
    setToast(null)
    setPendingStageMove(null)

    try {
      const idempotencyKey = generateIdempotencyKey(id, lead.stage_id, stageId)
      await pipelineApi.moveLeadStage(id, stageId, idempotencyKey, occurredAt ?? undefined)
      await loadData()
      setToast({ kind: 'success', text: 'Etapa actualizada' })
      setTimeout(() => setToast(null), 2000)
    } catch (err) {
      setSelectedStageId(lead.stage_id)
      setError(err instanceof Error ? err.message : 'Error al mover etapa')
      setToast({ kind: 'error', text: err instanceof Error ? err.message : 'Error al mover etapa' })
      setTimeout(() => setToast(null), 3000)
    } finally {
      setMoving(false)
    }
  }

  const handleStageSelectChange = (toStageId: string) => {
    if (!lead || toStageId === lead.stage_id) return
    setSelectedStageId(toStageId)
    const stage = stages.find((s) => s.id === toStageId)
    if (stage && isMilestoneStage(stage.name)) {
      setPendingStageMove({ toStageId })
      setOccurredAtForModal(todayLocalYmd())
    } else {
      handleMoveStage(toStageId)
    }
  }

  const handleConfirmOccurredAt = () => {
    if (!id || !lead || !pendingStageMove) return
    const occurredAtISO = ymdToLocalNoonISO(occurredAtForModal)
    handleMoveStage(pendingStageMove.toStageId, occurredAtISO)
  }

  const handleCancelOccurredAt = () => {
    setPendingStageMove(null)
    if (lead) setSelectedStageId(lead.stage_id)
  }

  const handleArchive = async () => {
    if (!id) return
    setSaving(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await pipelineApi.updateLead(id, {
        archived_at: new Date().toISOString(),
        archived_by: user?.id ?? null,
        archive_reason: archiveReasonInput.trim() || null,
      })
      setShowArchiveModal(false)
      setArchiveReasonInput('')
      await loadData()
      setToast({ kind: 'success', text: 'Lead archivado' })
      setTimeout(() => setToast(null), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al archivar')
    } finally {
      setSaving(false)
    }
  }

  const handleRestore = async () => {
    if (!id) return
    setSaving(true)
    setError(null)
    try {
      await pipelineApi.updateLead(id, {
        archived_at: null,
        archived_by: null,
        archive_reason: null,
      })
      await loadData()
      setToast({ kind: 'success', text: 'Lead restaurado' })
      setTimeout(() => setToast(null), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al restaurar')
    } finally {
      setSaving(false)
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
    <div style={{ paddingBottom: dirty ? UNSAVED_BAR_HEIGHT : 0 }}>
      {/* Header: fila 1 = nombre + chips; fila 2 = muted (tel/email); derecha = nav + acciones rápidas */}
      <div
        className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
        style={{ marginBottom: '16px' }}
      >
        <div className="flex flex-col gap-1.5 min-w-0">
          {/* Fila 1: Nombre + chips; link discreto a Pipeline */}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">
              {lead.full_name || 'Lead sin nombre'}
            </h1>
            {lead.archived_at && (
              <span className="inline-block rounded-full px-2 py-0.5 text-xs ring-1 bg-neutral-100 text-neutral-700 ring-neutral-200">
                Archivado
              </span>
            )}
            {lead.source && (
              <span className={getSourceTagClasses(lead.source)}>
                {lead.source}
              </span>
            )}
            {currentStage && (
              <span className={getStageTagClasses(currentStage.name)}>
                {displayStageName(currentStage.name)}
              </span>
            )}
          </div>
          {/* Fila 2: teléfono/email (navegación primaria = Volver, sin duplicar link Pipeline) */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-muted">
            {lead.phone && (
              <span className="flex items-center gap-0.5">
                <span>{lead.phone}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(lead.phone || '')
                    setToast({ kind: 'success', text: 'Teléfono copiado' })
                    setTimeout(() => setToast(null), 2000)
                  }}
                  className="btn btn-ghost p-0.5 min-w-0 h-auto text-xs opacity-70 hover:opacity-100"
                  aria-label="Copiar teléfono"
                  title="Copiar"
                >
                  ⎘
                </button>
                {!waNumber && (
                  <span className="text-xs opacity-80">· WhatsApp: número incompleto</span>
                )}
              </span>
            )}
            {lead.email && (
              <span className="flex items-center gap-0.5">
                <span>{lead.email}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(lead.email || '')
                    setToast({ kind: 'success', text: 'Email copiado' })
                    setTimeout(() => setToast(null), 2000)
                  }}
                  className="btn btn-ghost p-0.5 min-w-0 h-auto text-xs opacity-70 hover:opacity-100"
                  aria-label="Copiar email"
                  title="Copiar"
                >
                  ⎘
                </button>
              </span>
            )}
          </div>
        </div>
        {/* Derecha: navegación (Volver) + Acciones ▾ + acciones rápidas contacto */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-primary text-xs"
          >
            Volver
          </button>
          <div className="relative" ref={actionsRef}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setActionsOpen((o) => !o)
              }}
              disabled={saving}
              className="btn btn-ghost border border-border text-xs inline-flex items-center gap-1"
              aria-expanded={actionsOpen}
              aria-haspopup="true"
            >
              Acciones <span aria-hidden>▾</span>
            </button>
            {actionsOpen && (
              <div
                className="absolute right-0 top-full mt-1 min-w-[140px] rounded-md border border-border bg-bg py-1 shadow-lg z-10"
                role="menu"
              >
                {lead.archived_at ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setActionsOpen(false)
                      handleRestore()
                    }}
                    disabled={saving}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50"
                  >
                    {saving ? '…' : 'Restaurar'}
                  </button>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setActionsOpen(false)
                      setShowArchiveModal(true)
                    }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-black/5"
                  >
                    Archivar…
                  </button>
                )}
              </div>
            )}
          </div>
          {(waNumber || lead.phone || lead.email) && (
            <div className="flex border border-border rounded-md overflow-hidden [&>a]:rounded-none [&>a]:border-r [&>a]:border-border [&>a:last-child]:border-r-0">
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
              {lead.phone ? (
                <a
                  href={`tel:${(lead.phone || '').replace(/\s/g, '')}`}
                  className="btn btn-ghost px-2 py-1 text-xs"
                >
                  Llamar
                </a>
              ) : null}
              {lead.email ? (
                <a href={`mailto:${lead.email}`} className="btn btn-ghost px-2 py-1 text-xs">
                  Email
                </a>
              ) : null}
            </div>
          )}
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

      <UnsavedChangesBar
        open={dirty}
        onSave={handleSave}
        onDiscard={handleDiscard}
        isSaving={saving}
      />

      {/* Modal: confirmar fecha real al mover a etapa hito */}
      {pendingStageMove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="occurred-at-modal-title"
        >
          <div className="bg-bg border border-border rounded-lg shadow-lg max-w-sm w-full p-4">
            <h3 id="occurred-at-modal-title" className="text-base font-semibold mb-2">
              Confirmar fecha real
            </h3>
            <p className="text-sm text-muted mb-3">¿Cuándo ocurrió este evento?</p>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setOccurredAtForModal(todayLocalYmd())}
                className="btn btn-ghost border border-border text-xs py-1.5 px-2 rounded-md"
              >
                Hoy
              </button>
            </div>
            <div className="mb-4">
              <label htmlFor="occurred_at_date" className="block text-xs font-medium text-muted mb-1">
                Fecha
              </label>
              <input
                id="occurred_at_date"
                type="date"
                value={occurredAtForModal}
                max={todayLocalYmd()}
                onChange={(e) => setOccurredAtForModal(e.target.value)}
                className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={handleCancelOccurredAt} className="btn btn-ghost text-sm">
                Cancelar
              </button>
              <button type="button" onClick={handleConfirmOccurredAt} className="btn btn-primary text-sm">
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: archivar lead */}
      {showArchiveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-modal-title"
        >
          <div className="bg-bg border border-border rounded-lg shadow-lg max-w-sm w-full p-4">
            <h3 id="archive-modal-title" className="text-base font-semibold mb-2">
              Archivar lead
            </h3>
            <p className="text-sm text-muted mb-3">¿Archivar este lead? Puedes agregar un motivo opcional.</p>
            <div className="mb-4">
              <label htmlFor="archive_reason" className="block text-xs font-medium text-muted mb-1">
                Motivo (opcional)
              </label>
              <textarea
                id="archive_reason"
                value={archiveReasonInput}
                onChange={(e) => setArchiveReasonInput(e.target.value)}
                placeholder="Ej. No contesta, fuera de mercado..."
                rows={2}
                className="w-full rounded-md border border-border px-2 py-1.5 text-sm resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => { setShowArchiveModal(false); setArchiveReasonInput('') }} className="btn btn-ghost text-sm">
                Cancelar
              </button>
              <button type="button" onClick={handleArchive} disabled={saving} className="btn btn-primary text-sm">
                {saving ? '…' : 'Archivar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid: mobile = 1 col (Seguimiento, Pipeline, Hitos, Datos, Actividad); desktop = 2 cols */}
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
          {/* Encabezado: título a la izquierda; a la derecha badge + "Próximo: {fecha}" */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
              Seguimiento
            </h3>
            <span className="flex items-center gap-2 text-sm text-muted">
              {followUpStatus !== 'none' && (
                <span
                  className={
                    followUpStatus === 'overdue'
                      ? 'px-1.5 py-0 text-xs rounded bg-danger/15 text-danger'
                      : followUpStatus === 'today'
                        ? 'px-1.5 py-0 text-xs rounded bg-warning/15 text-warning'
                        : 'px-1.5 py-0 text-xs rounded bg-black/5'
                  }
                >
                  {followUpStatus === 'overdue' && 'Vencido'}
                  {followUpStatus === 'today' && 'Hoy'}
                  {followUpStatus === 'upcoming' && 'Próximo'}
                </span>
              )}
              <span className="text-xs">Próximo: {humanizeNextFollowUp(nextYmd)}</span>
            </span>
          </div>
          {/* Acciones: solo "Registrar contacto de hoy" + descripción; guardado principal en sticky bar */}
          <div className="mb-3">
            <button
              onClick={handleMarkContact}
              disabled={markingContact || saving}
              className="btn btn-primary text-xs"
            >
              {markingContact ? 'Registrando…' : 'Registrar contacto de hoy'}
            </button>
            <p className="text-xs text-muted mt-1 max-w-[240px]">
              Actualiza &quot;Último contacto&quot; a hoy y agenda el próximo seguimiento.
            </p>
          </div>
          {/* Inputs: desktop 2 columnas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label htmlFor="next_follow_up_at" className="block text-xs font-medium text-muted mb-1">
                Próximo seguimiento
              </label>
              <input
                id="next_follow_up_at"
                type="date"
                value={nextFollowUpAt}
                onChange={(e) => setNextFollowUpAt(e.target.value)}
                disabled={saving}
                className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label htmlFor="last_contact_at" className="block text-xs font-medium text-muted mb-1">
                Último contacto
              </label>
              <input
                id="last_contact_at"
                type="date"
                value={lastContactAt}
                onChange={(e) => setLastContactAt(e.target.value)}
                disabled={saving}
                className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
              />
            </div>
          </div>
        </div>

        {/* 2. Pipeline — sidebar: etapa actual + tiempos + fechas */}
        <div
          className="card lg:col-span-4 lg:sticky lg:top-4 self-start"
          style={{
            padding: '16px',
            transition: prefersReducedMotion ? 'none' : 'all 150ms ease-out',
          }}
        >
          <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: 'var(--muted)' }}>
            Pipeline
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
                fontSize: '12px',
                fontWeight: '500',
                color: 'var(--muted)',
              }}
            >
              Etapa actual
            </label>
            {lead.archived_at ? (
              <p className="text-sm text-muted py-2">Restaura para editar</p>
            ) : (
              <select
                id="stage_select"
                value={selectedStageId}
                onChange={(e) => {
                  const v = e.target.value
                  if (v && v !== lead.stage_id) handleStageSelectChange(v)
                  else setSelectedStageId(v)
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
                    {displayStageName(stage.name)}
                  </option>
                ))}
              </select>
            )}
          </div>
          {/* Tiempos */}
          <div className="mt-3 pt-3 border-t border-black/10">
            <p className="text-xs font-medium text-muted mb-2">Tiempos</p>
            <div className="text-xs text-muted space-y-1">
              <div className="flex justify-between gap-2">
                <span>Días desde Cita realizada</span>
                <span className="text-text tabular-nums">
                  {citaRealizadaAt ? Math.floor(diffDaysFloor(citaRealizadaAt, new Date())) : '—'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Días desde Propuesta presentada</span>
                <span className="text-text tabular-nums">
                  {propuestaAt ? Math.floor(diffDaysFloor(propuestaAt, new Date())) : '—'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Días en etapa actual</span>
                <span className="text-text tabular-nums">
                  {enteredCurrentStageAt ? Math.floor(diffDaysFloor(enteredCurrentStageAt, new Date())) : '—'}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span>Tiempo total del lead</span>
                <span className="text-text tabular-nums">
                  {cierreAt
                    ? Math.floor(diffDaysFloor(lead.created_at, cierreAt))
                    : lead.created_at
                      ? Math.floor(diffDaysFloor(lead.created_at, new Date()))
                      : '—'}
                </span>
              </div>
            </div>
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

        {/* 2b. Hitos — columna izquierda, debajo de Seguimiento; solo lectura */}
        <div className="lg:col-span-8 rounded-lg border border-border bg-bg/30 p-4">
          <h3 className="text-sm font-medium text-muted mb-3">Hitos</h3>
          <div className="text-sm space-y-2">
            <div className="flex justify-between gap-2">
              <span className="text-muted">Creado</span>
              <span className="tabular-nums">{formatDateMX(lead.created_at)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted">Cita realizada</span>
              <span className="tabular-nums">{formatDateMX(citaRealizadaAt)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted">Propuesta presentada</span>
              <span className="tabular-nums">{formatDateMX(propuestaAt)}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted">Cerrado/Ganado</span>
              <span className="tabular-nums">{formatDateMX(cierreAt)}</span>
            </div>
          </div>
        </div>

        {/* 3. Datos / Notas — card secundaria; por defecto modo lectura, "Editar datos" para editar */}
        <div
          className="lg:col-span-8 rounded-lg border border-border bg-bg/30 p-4"
          style={{
            transition: prefersReducedMotion ? 'none' : 'all 150ms ease-out',
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-medium text-muted">
              Datos
            </h3>
            {!isEditingDatos ? (
              <button
                type="button"
                onClick={() => setIsEditingDatos(true)}
                className="btn btn-ghost text-xs px-2 py-1"
                aria-label="Editar datos"
              >
                <span aria-hidden>✏️</span> Editar datos
              </button>
            ) : null}
          </div>
          {isEditingDatos ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label htmlFor="full_name" className="block text-xs font-medium text-muted mb-1">
                  Nombre completo *
                </label>
                <input
                  id="full_name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={saving}
                  className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
                  required
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-xs font-medium text-muted mb-1">
                  Teléfono
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={saving}
                  className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-muted mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={saving}
                  className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label htmlFor="source" className="block text-xs font-medium text-muted mb-1">
                  Fuente
                </label>
                <select
                  id="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  disabled={saving}
                  className="w-full rounded-md border border-border px-2 py-1.5 text-sm"
                >
                  <option value="">Seleccionar fuente</option>
                  {SOURCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label htmlFor="notes" className="block text-xs font-medium text-muted mb-1">
                  Notas
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={saving}
                  rows={3}
                  className="w-full rounded-md border border-border px-2 py-1.5 text-sm resize-y"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-xs text-muted block mb-0.5">Nombre completo</span>
                <span className="text-text">{fullName || '—'}</span>
              </div>
              <div>
                <span className="text-xs text-muted block mb-0.5">Teléfono</span>
                <span className="text-text">{phone || '—'}</span>
              </div>
              <div>
                <span className="text-xs text-muted block mb-0.5">Email</span>
                <span className="text-text">{email || '—'}</span>
              </div>
              <div>
                <span className="text-xs text-muted block mb-0.5">Fuente</span>
                <span className="text-text">{source || '—'}</span>
              </div>
              <div className="md:col-span-2">
                <span className="text-xs text-muted block mb-0.5">Notas</span>
                <span className="text-text whitespace-pre-wrap">{notes || '—'}</span>
              </div>
            </div>
          )}
        </div>

        {/* 4. Actividad — historial de etapas + placeholder; colapsada por defecto */}
        <div className="lg:col-span-8 rounded-lg border border-border bg-bg/20 p-4">
          <button
            type="button"
            onClick={() => setActividadExpanded((e) => !e)}
            className="flex w-full items-center justify-between gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary rounded"
            aria-expanded={actividadExpanded}
            aria-controls="actividad-content"
          >
            <h3 className="text-sm font-medium text-muted">
              Actividad
            </h3>
            <span className="text-muted text-xs" aria-hidden>
              {actividadExpanded ? '▼' : '▶'}
            </span>
          </button>
          {actividadExpanded && (
            <div id="actividad-content" className="mt-3 pt-3 border-t border-border">
              {stageHistory.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted mb-2">Historial de etapas</p>
                  {stageHistory.map((h) => {
                    const fromName = h.from_stage_id ? (stageNameById.get(h.from_stage_id) ?? '—') : 'Inicio'
                    const toName = stageNameById.get(h.to_stage_id) ?? '—'
                    const when = h.occurred_at ?? h.moved_at
                    return (
                      <div key={h.id} className="text-sm flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="tabular-nums text-muted">{formatDateMX(when)}</span>
                        <span>De {fromName} → {toName}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted">
                  Sin historial de etapas aún.
                </p>
              )}
            </div>
          )}
          {!actividadExpanded && (
            <p className="text-xs text-muted mt-1">
              {stageHistory.length > 0 ? `${stageHistory.length} movimiento(s) de etapa` : 'Sin eventos recientes'}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
