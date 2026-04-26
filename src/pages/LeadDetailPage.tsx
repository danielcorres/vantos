import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { flushSync } from 'react-dom'
import { useParams, useNavigate, useBlocker } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { pipelineApi, type LeadStageHistoryRow, type PipelineStage } from '../features/pipeline/pipeline.api'
import { MoveBackwardConfirmDialog } from '../features/pipeline/components/MoveBackwardConfirmDialog'
import {
  getMultiStepBackwardBlockedMessage,
  isBackwardStageMove,
  isImmediateBackwardStageMove,
  RETROCESO_BLOCKED_TOAST_MS,
} from '../features/pipeline/utils/stageMoveDirection'
import { generateIdempotencyKey } from '../features/pipeline/pipeline.store'
import { formatDateMX, diffDaysFloor, ymdToLocalNoonISO } from '../shared/utils/dates'
import { formatCurrencyMXN } from '../shared/utils/format'
import { useReducedMotion } from '../shared/hooks/useReducedMotion'
import { useDirtyState } from '../shared/hooks/useDirtyState'
import { UnsavedChangesBar, UNSAVED_BAR_HEIGHT } from '../shared/components/UnsavedChangesBar'
import { getStageTagClasses, displayStageName } from '../shared/utils/stageStyles'
import { LeadSourceTag } from '../components/pipeline/LeadSourceTag'
import { LeadAppointmentsList } from '../features/calendar/components/LeadAppointmentsList'
import { AppointmentFormModal } from '../features/calendar/components/AppointmentFormModal'
import type { LeadTemperature } from '../features/pipeline/pipeline.api'
import { useAuth } from '../shared/auth/AuthProvider'
import { AnimatedContainer } from '../components/ui/AnimatedContainer'

const DELETE_LEAD_CONFIRM_WORD = 'ELIMINAR'

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
  archived_at: string | null
  archived_by: string | null
  archive_reason: string | null
  referral_name: string | null
  lead_condition: string | null
  estimated_value: number | null
  expected_close_at: string | null
  owner_user_id: string | null
  temperature: LeadTemperature | null
}

const TOAST_CLEAR_MS = 2800

/** Superficies compactas tipo card (minimal, claro/oscuro). */
const CARD_SURFACE =
  'rounded-xl border border-neutral-200/90 dark:border-neutral-700/80 bg-white dark:bg-neutral-950/50 shadow-sm'
const CARD_PAD = 'p-3 sm:p-4'
const SECTION_LABEL =
  'text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400'
const FIELD_LABEL = 'block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1'
const CONTROL =
  'w-full rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-2.5 py-1.5 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-500 dark:placeholder:text-neutral-400 transition-[border-color,box-shadow] duration-150 focus-visible:border-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-200/70 dark:focus-visible:ring-neutral-600/40 disabled:opacity-50'

const SOURCE_OPTIONS = [
  { value: 'Referido', label: 'Referido' },
  { value: 'Mercado natural', label: 'Mercado natural' },
  { value: 'Frío', label: 'Frío' },
  { value: 'Social media', label: 'Social media' },
] as const

type Stage = {
  id: string
  name: string
  slug?: string
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

/** Email vacío = válido (opcional). Sin espacios; formato razonable tipo user@dominio.ext */
function isValidEmail(email: string): boolean {
  const t = email.trim()
  if (!t) return true
  if (/\s/.test(t)) return false
  // Local @ domain con al menos un punto en el dominio y TLD ≥ 2
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t) && !t.startsWith('@') && !t.endsWith('@')
}

function phoneDigits(phone: string): string {
  return (phone || '').replace(/\D/g, '')
}

const PHONE_DIAL_MX = '52'

/** Interpreta teléfono guardado hacia código de país + dígitos nacionales (solo MX +52 en UI). */
function parseStoredPhoneForForm(raw: string | null | undefined): { dialCode: string; nationalDigits: string } {
  const d = phoneDigits(raw || '')
  if (!d) return { dialCode: PHONE_DIAL_MX, nationalDigits: '' }
  if (d.startsWith(PHONE_DIAL_MX) && d.length >= 12) {
    return { dialCode: PHONE_DIAL_MX, nationalDigits: d.slice(2, 12) }
  }
  if (d.length === 10) {
    return { dialCode: PHONE_DIAL_MX, nationalDigits: d }
  }
  return { dialCode: PHONE_DIAL_MX, nationalDigits: d.slice(0, 10) }
}

function composePhoneForSave(dialCode: string, nationalDigits: string): string | null {
  const n = nationalDigits.replace(/\D/g, '').slice(0, 10)
  if (!n) return null
  return `+${dialCode}${n}`
}

function nationalPhoneDigitsOnly(value: string): string {
  return value.replace(/\D/g, '').slice(0, 10)
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
  const { user } = useAuth()

  const [lead, setLead] = useState<LeadData | null>(null)
  const [stages, setStages] = useState<Stage[]>([])
  const [stageHistory, setStageHistory] = useState<LeadStageHistoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  // Form state
  const [fullName, setFullName] = useState('')
  const [phoneNationalDigits, setPhoneNationalDigits] = useState('')
  const [email, setEmail] = useState('')
  const [source, setSource] = useState('')
  const [notes, setNotes] = useState('')
  const [referralName, setReferralName] = useState('')

  // Stage change state
  const [selectedStageId, setSelectedStageId] = useState<string>('')
  const [pendingStageId, setPendingStageId] = useState<string | null>(null)
  const [backwardConfirmToStageId, setBackwardConfirmToStageId] = useState<string | null>(null)

  // Opportunity state
  const [estimatedValue, setEstimatedValue] = useState<string>('')
  const [expectedCloseAt, setExpectedCloseAt] = useState<string>('')
  const [ownerDisplayName, setOwnerDisplayName] = useState<string | null>(null)
  const [savingOpportunity, setSavingOpportunity] = useState(false)

  // Action states
  const [saving, setSaving] = useState(false)
  const [savingTemperature, setSavingTemperature] = useState(false)
  const [moving, setMoving] = useState(false)
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  const [actividadExpanded, setActividadExpanded] = useState(false)
  // Archivar: modal + motivo
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [archiveReasonInput, setArchiveReasonInput] = useState('')
  const [showDeleteLeadModal, setShowDeleteLeadModal] = useState(false)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')
  const [deletingLead, setDeletingLead] = useState(false)
  // Dropdown Acciones (Archivar/Restaurar)
  const [actionsOpen, setActionsOpen] = useState(false)
  const actionsRef = useRef<HTMLDivElement>(null)
  const [appointmentModalOpen, setAppointmentModalOpen] = useState(false)
  const [appointmentsListKey, setAppointmentsListKey] = useState(0)
  /** Evita marcar dirty hasta que el formulario refleje el lead de la ruta (evita bloqueo fantasma al cargar). */
  const [leadFormHydrated, setLeadFormHydrated] = useState(false)
  /** Permite un intento de navegación sin pasar por useBlocker (p. ej. Regresar tras confirmar o con estado desfasado). */
  const bypassNavigationBlockRef = useRef(false)

  // Reduced motion
  const prefersReducedMotion = useReducedMotion()

  const originalSnapshot = useMemo(() => {
    if (!lead) return null
    const phoneParts = parseStoredPhoneForForm(lead.phone)
    return {
      full_name: lead.full_name || '',
      phoneNationalDigits: phoneParts.nationalDigits,
      email: (lead.email || '').replace(/\s/g, ''),
      source: lead.source || '',
      notes: lead.notes || '',
      referral_name: lead.referral_name || '',
    }
  }, [lead])
  const currentSnapshot = useMemo(
    () => ({
      full_name: fullName,
      phoneNationalDigits,
      email,
      source,
      notes,
      referral_name: referralName,
    }),
    [fullName, phoneNationalDigits, email, source, notes, referralName]
  )
  // useDirtyState se ejecuta SIEMPRE (Rules of Hooks); la condición solo aplica al valor derivado
  const isDirty = useDirtyState(originalSnapshot, currentSnapshot)
  const dirty =
    lead != null && lead.id === id && leadFormHydrated && isDirty

  const stageNameById = useMemo(() => {
    const m = new Map<string, string>()
    stages.forEach((s) => m.set(s.id, s.name))
    return m
  }, [stages])

  // Fecha de entrada a la etapa actual para "días en etapa" desde historial
  const enteredCurrentStageAt = useMemo(() => {
    if (!lead) return null
    if (stageHistory.length) {
      const currentEntries = stageHistory.filter((h) => h.to_stage_id === lead.stage_id)
      if (currentEntries.length) {
        const last = currentEntries[currentEntries.length - 1]
        return last.occurred_at ?? last.moved_at
      }
      return lead.stage_changed_at ?? lead.created_at
    }
    return lead.stage_changed_at ?? lead.created_at
  }, [lead, stageHistory])

  useEffect(() => {
    if (id) {
      loadData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run only when id changes
  }, [id])

  useEffect(() => {
    setLeadFormHydrated(false)
  }, [id])

  // Initialize form when lead loads; do not overwrite selectedStageId while moving
  useEffect(() => {
    if (!lead || lead.id !== id) return
    setFullName(lead.full_name || '')
    const phoneParts = parseStoredPhoneForForm(lead.phone)
    setPhoneNationalDigits(phoneParts.nationalDigits)
    setEmail((lead.email || '').replace(/\s/g, ''))
    setSource(lead.source || '')
    setNotes(lead.notes || '')
    setReferralName(lead.referral_name || '')
    setEstimatedValue(lead.estimated_value != null ? String(lead.estimated_value) : '')
    setExpectedCloseAt(
      lead.expected_close_at
        ? new Date(lead.expected_close_at).toISOString().slice(0, 10)
        : ''
    )
    if (!moving) setSelectedStageId(lead.stage_id)
    setLeadFormHydrated(true)
  }, [lead, moving, id])

  // Load owner display name from profiles
  useEffect(() => {
    if (!lead?.owner_user_id) {
      setOwnerDisplayName(null)
      return
    }
    void (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('full_name, first_name, last_name')
          .eq('user_id', lead.owner_user_id)
          .single()
        if (data) {
          const fn = (data.full_name as string)?.trim()
          if (fn) {
            setOwnerDisplayName(fn)
          } else {
            const f = (data.first_name as string)?.trim() ?? ''
            const l = (data.last_name as string)?.trim() ?? ''
            setOwnerDisplayName(f || l ? `${f} ${l}`.trim() : '—')
          }
        } else {
          setOwnerDisplayName('—')
        }
      } catch {
        setOwnerDisplayName('—')
      }
    })()
  }, [lead?.owner_user_id])

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
            'id,full_name,phone,email,source,notes,stage_id,stage_changed_at,created_at,updated_at,archived_at,archived_by,archive_reason,referral_name,lead_condition,estimated_value,expected_close_at,owner_user_id,temperature'
          )
          .eq('id', id)
          .single(),
        supabase
          .from('pipeline_stages')
          .select('id,name,slug,position')
          .eq('is_active', true)
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
    const phoneParts = parseStoredPhoneForForm(lead.phone)
    setPhoneNationalDigits(phoneParts.nationalDigits)
    setEmail((lead.email || '').replace(/\s/g, ''))
    setSource(lead.source || '')
    setNotes(lead.notes || '')
    setReferralName(lead.referral_name || '')
  }, [lead])

  const handleGoBack = useCallback(() => {
    if (dirty) {
      if (!window.confirm('Tienes cambios sin guardar. ¿Salir sin guardar?')) return
      flushSync(() => {
        discardChanges()
      })
    }
    bypassNavigationBlockRef.current = true
    try {
      void navigate(-1)
    } finally {
      queueMicrotask(() => {
        bypassNavigationBlockRef.current = false
      })
    }
  }, [dirty, discardChanges, navigate])

  const blocker = useBlocker(
    useCallback(() => dirty && !bypassNavigationBlockRef.current, [dirty])
  )

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    const ok = window.confirm('Tienes cambios sin guardar. ¿Salir sin guardar?')
    if (ok) {
      discardChanges()
      blocker.proceed()
    } else {
      blocker.reset()
    }
  }, [blocker, discardChanges])

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

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

  useEffect(() => {
    if (!showArchiveModal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowArchiveModal(false)
        setArchiveReasonInput('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showArchiveModal])

  useEffect(() => {
    if (!showDeleteLeadModal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDeleteLeadModal(false)
        setDeleteConfirmInput('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showDeleteLeadModal])

  const handleSave = async () => {
    if (!id || !lead) return

    // Validation
    if (!fullName.trim()) {
      setError('El nombre completo es requerido')
      return
    }

    const national = nationalPhoneDigitsOnly(phoneNationalDigits)
    if (national.length > 0 && national.length < 10) {
      setError('El teléfono en México debe tener 10 dígitos, o déjalo vacío.')
      return
    }

    if (email.trim() && !isValidEmail(email)) {
      setError('Introduce un correo válido (ej. nombre@empresa.com) o déjalo vacío.')
      return
    }

    setSaving(true)
    setError(null)
    setToast(null)

    try {
      await pipelineApi.updateLead(id, {
        full_name: fullName.trim(),
        phone: composePhoneForSave(PHONE_DIAL_MX, national),
        email: email.trim() || null,
        source: source.trim() || null,
        notes: notes.trim() || null,
        referral_name: referralName.trim() || null,
      })

      await loadData()
      setToast({ kind: 'success', text: 'Guardado' })
      setTimeout(() => setToast(null), TOAST_CLEAR_MS)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar'
      setError(msg)
      setToast({ kind: 'error', text: msg })
      setTimeout(() => setToast(null), TOAST_CLEAR_MS)
    } finally {
      setSaving(false)
    }
  }

  const handlePipelineTemperatureChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!id || !lead || lead.archived_at) return
    const v = e.target.value
    const next: LeadTemperature | null = v === '' ? null : (v as LeadTemperature)
    if (next === lead.temperature) return

    setSavingTemperature(true)
    setError(null)
    setToast(null)
    try {
      await pipelineApi.updateLead(id, { temperature: next })
      await loadData()
      setToast({ kind: 'success', text: 'Temperatura actualizada' })
      setTimeout(() => setToast(null), TOAST_CLEAR_MS)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar temperatura'
      setError(msg)
      setToast({ kind: 'error', text: msg })
      setTimeout(() => setToast(null), TOAST_CLEAR_MS)
    } finally {
      setSavingTemperature(false)
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
      setTimeout(() => setToast(null), TOAST_CLEAR_MS)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al mover etapa'
      setSelectedStageId(lead.stage_id)
      setError(msg)
      setToast({ kind: 'error', text: msg })
      setTimeout(() => setToast(null), TOAST_CLEAR_MS)
    } finally {
      setMoving(false)
    }
  }

  const handleStageSelectChange = (toStageId: string) => {
    if (!lead || toStageId === lead.stage_id) return
    setSelectedStageId(toStageId)
    setPendingStageId(toStageId)
  }

  const confirmStageChange = () => {
    if (!pendingStageId || !lead) return
    if (isBackwardStageMove(lead.stage_id, pendingStageId, stages as PipelineStage[])) {
      if (!isImmediateBackwardStageMove(lead.stage_id, pendingStageId, stages as PipelineStage[])) {
        setPendingStageId(null)
        setSelectedStageId(lead.stage_id)
        setToast({
          kind: 'error',
          text: getMultiStepBackwardBlockedMessage(lead.stage_id, stages as PipelineStage[]),
        })
        setTimeout(() => setToast(null), RETROCESO_BLOCKED_TOAST_MS)
        return
      }
      setBackwardConfirmToStageId(pendingStageId)
      setPendingStageId(null)
      setSelectedStageId(lead.stage_id)
      return
    }
    const to = pendingStageId
    setPendingStageId(null)
    void handleMoveStage(to)
  }

  const cancelStageChange = () => {
    if (!lead) return
    setPendingStageId(null)
    setSelectedStageId(lead.stage_id)
    setBackwardConfirmToStageId(null)
  }

  const handleSaveOpportunity = async () => {
    if (!id) return
    setSavingOpportunity(true)
    setError(null)
    setToast(null)
    try {
      const ev = estimatedValue.trim() ? parseFloat(estimatedValue.replace(/,/g, '')) : null
      const eco = expectedCloseAt.trim()
        ? ymdToLocalNoonISO(expectedCloseAt)
        : null
      await pipelineApi.updateLead(id, {
        estimated_value: ev != null && !Number.isNaN(ev) ? ev : null,
        expected_close_at: eco,
      })
      await loadData()
      setToast({ kind: 'success', text: 'Oportunidad actualizada' })
      setTimeout(() => setToast(null), TOAST_CLEAR_MS)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar'
      setToast({ kind: 'error', text: msg })
      setTimeout(() => setToast(null), TOAST_CLEAR_MS)
    } finally {
      setSavingOpportunity(false)
    }
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

  const canDeleteLeadPermanently =
    Boolean(id && lead?.owner_user_id && user?.id && lead.owner_user_id === user.id)

  const handleDeleteLeadPermanent = async () => {
    if (!id) return
    if (deleteConfirmInput.trim().toUpperCase() !== DELETE_LEAD_CONFIRM_WORD) return
    setDeletingLead(true)
    setError(null)
    setToast(null)
    try {
      bypassNavigationBlockRef.current = true
      await pipelineApi.deleteLead(id)
      setShowDeleteLeadModal(false)
      setDeleteConfirmInput('')
      navigate('/pipeline')
    } catch (err) {
      bypassNavigationBlockRef.current = false
      const msg = err instanceof Error ? err.message : 'No se pudo eliminar el lead'
      setError(msg)
      setToast({ kind: 'error', text: msg })
      setTimeout(() => setToast(null), TOAST_CLEAR_MS)
    } finally {
      setDeletingLead(false)
    }
  }

  const currentStage = stages.find((s) => s.id === lead?.stage_id)

  if (loading) {
    return (
      <AnimatedContainer
        variant="up"
        className="mx-auto max-w-6xl px-2 sm:px-4 py-4 space-y-4"
      >
        <div className="h-8 w-44 rounded-lg bg-neutral-200/90 dark:bg-neutral-800 animate-pulse motion-reduce:animate-none" />
        <div className={`${CARD_SURFACE} ${CARD_PAD} space-y-3`}>
          <div className="h-10 max-w-md rounded-lg bg-neutral-100 dark:bg-neutral-800/90 animate-pulse motion-reduce:animate-none" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-16 rounded-lg bg-neutral-100 dark:bg-neutral-800/90 animate-pulse motion-reduce:animate-none" />
            <div className="h-16 rounded-lg bg-neutral-100 dark:bg-neutral-800/90 animate-pulse motion-reduce:animate-none" />
            <div className="h-16 rounded-lg bg-neutral-100 dark:bg-neutral-800/90 sm:col-span-2 animate-pulse motion-reduce:animate-none" />
          </div>
        </div>
      </AnimatedContainer>
    )
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-6xl px-2 sm:px-4 py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Detalle del lead</h2>
          <button type="button" onClick={handleGoBack} className="btn btn-ghost border border-border text-sm">
            Regresar
          </button>
        </div>
        <div className={`${CARD_SURFACE} ${CARD_PAD} text-center`}>
          <p className="mb-2 text-base font-medium text-neutral-900 dark:text-neutral-100">Lead no encontrado</p>
          <p className="mb-6 text-sm text-neutral-600 dark:text-neutral-400">
            El lead que buscas no existe o no tienes permisos para verlo.
          </p>
          <button type="button" onClick={() => navigate('/pipeline')} className="btn btn-primary text-sm">
            Ir al Pipeline
          </button>
        </div>
      </div>
    )
  }

  if (error && !lead) {
    return (
      <div className="mx-auto max-w-6xl px-2 sm:px-4 py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Detalle del lead</h2>
          <button type="button" onClick={handleGoBack} className="btn btn-ghost border border-border text-sm">
            Regresar
          </button>
        </div>
        <div className="rounded-xl border border-red-200/80 bg-red-50/40 dark:bg-red-950/20 dark:border-red-800/60 p-4">
          <p className="mb-3 text-sm text-red-900 dark:text-red-200">{error}</p>
          <button type="button" onClick={loadData} className="btn btn-primary text-sm">
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!lead) {
    return null
  }

  const waNumber = normalizeWhatsAppNumber(phoneDigits(lead.phone || ''))

  return (
    <>
    <div
      className={`mx-auto max-w-6xl px-2 sm:px-4 ${dirty ? '' : 'pb-6'}`}
      style={{ paddingBottom: dirty ? UNSAVED_BAR_HEIGHT : undefined }}
    >
      {/* Header: nombre + chips; contacto; acciones */}
      <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-2xl">
              {lead.full_name || 'Lead sin nombre'}
            </h1>
            {lead.archived_at && (
              <span className="inline-block rounded-full px-2 py-0.5 text-xs ring-1 bg-neutral-100 text-neutral-700 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:ring-neutral-600">
                Archivado
              </span>
            )}
            {lead.source ? <LeadSourceTag source={lead.source} /> : null}
            {currentStage && (
              <span className={getStageTagClasses(currentStage.slug)}>
                {displayStageName(currentStage.name)}
              </span>
            )}
          </div>
          {/* Fila 2: teléfono / email + acciones de contacto (WhatsApp, Llamar, Email) como chips */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-neutral-600 dark:text-neutral-400">
            {lead.phone && (
              <span className="flex items-center gap-1">
                <span>{lead.phone}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(lead.phone || '')
                    setToast({ kind: 'success', text: 'Teléfono copiado' })
                    setTimeout(() => setToast(null), TOAST_CLEAR_MS)
                  }}
                  className="btn btn-ghost px-1.5 py-0.5 min-w-0 h-auto text-xs opacity-80 hover:opacity-100"
                  aria-label="Copiar teléfono al portapapeles"
                >
                  Copiar
                </button>
              </span>
            )}
            {lead.email && (
              <span className="flex items-center gap-1">
                <span>{lead.email}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(lead.email || '')
                    setToast({ kind: 'success', text: 'Email copiado' })
                    setTimeout(() => setToast(null), TOAST_CLEAR_MS)
                  }}
                  className="btn btn-ghost px-1.5 py-0.5 min-w-0 h-auto text-xs opacity-80 hover:opacity-100"
                  aria-label="Copiar email al portapapeles"
                >
                  Copiar
                </button>
              </span>
            )}
            {(waNumber || lead.phone || lead.email) && (
              <span className="inline-flex items-center gap-1 flex-wrap">
                {waNumber ? (
                  <a
                    href={`https://wa.me/${waNumber}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost px-2 py-0.5 text-xs rounded-md border border-border/60 hover:bg-black/5"
                  >
                    WhatsApp
                  </a>
                ) : null}
                {lead.phone ? (
                  <a
                    href={`tel:${(lead.phone || '').replace(/\s/g, '')}`}
                    className="btn btn-ghost px-2 py-0.5 text-xs rounded-md border border-border/60 hover:bg-black/5"
                  >
                    Llamar
                  </a>
                ) : null}
                {lead.email ? (
                  <a
                    href={`mailto:${lead.email}`}
                    className="btn btn-ghost px-2 py-0.5 text-xs rounded-md border border-border/60 hover:bg-black/5"
                  >
                    Email
                  </a>
                ) : null}
              </span>
            )}
          </div>
        </div>
        {/* Derecha: solo Regresar + Acciones */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleGoBack}
            className="relative z-30 btn btn-ghost border border-border text-xs"
          >
            Regresar
          </button>
          <div className="relative z-10" ref={actionsRef}>
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
                className="absolute right-0 top-full mt-1 min-w-[180px] rounded-md border border-border bg-bg py-1 shadow-lg z-10"
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
                {canDeleteLeadPermanently ? (
                  <>
                    <div className="my-1 h-px bg-border/80" role="separator" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setActionsOpen(false)
                        setDeleteConfirmInput('')
                        setShowDeleteLeadModal(true)
                      }}
                      disabled={saving || deletingLead}
                      className="w-full text-left px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40 disabled:opacity-50"
                    >
                      Eliminar permanentemente…
                    </button>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200/80 bg-red-50/50 px-3 py-2 text-sm text-red-900 dark:border-red-800/50 dark:bg-red-950/25 dark:text-red-200">
          {error}
        </div>
      )}

      {/* Toast — success: verde claro; error: rojo suave */}
      {toast && (
        <div
          className={`mb-4 rounded-lg px-3 py-2 text-sm ${
            toast.kind === 'error'
              ? 'border border-red-200 bg-red-50/60 text-red-900 dark:border-red-800/60 dark:bg-red-950/30 dark:text-red-100'
              : 'border border-emerald-200/90 bg-emerald-50 text-emerald-900 dark:border-emerald-800/50 dark:bg-emerald-950/35 dark:text-emerald-100'
          }`}
          role="status"
          aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
        >
          {toast.text}
        </div>
      )}

      <UnsavedChangesBar
        open={dirty}
        onSave={handleSave}
        onDiscard={discardChanges}
        isSaving={saving}
      />

      {/* Modal: archivar lead */}
      {showArchiveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-modal-title"
          aria-describedby="archive-modal-description"
        >
          <div className="bg-bg dark:bg-neutral-900 border border-border dark:border-neutral-700 rounded-lg shadow-lg max-w-sm w-full p-4">
            <h3 id="archive-modal-title" className="text-base font-semibold mb-2 text-text dark:text-neutral-100">
              Archivar lead
            </h3>
            <p id="archive-modal-description" className="text-sm text-muted dark:text-neutral-400 mb-3">
              ¿Archivar este lead? Puedes agregar un motivo opcional.
            </p>
            <div className="mb-4">
              <label htmlFor="archive_reason" className="block text-xs font-medium text-muted dark:text-neutral-400 mb-1">
                Motivo (opcional)
              </label>
              <textarea
                id="archive_reason"
                value={archiveReasonInput}
                onChange={(e) => setArchiveReasonInput(e.target.value)}
                placeholder="Ej. No contesta, fuera de mercado..."
                rows={2}
                className={`${CONTROL} resize-none`}
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

      {showDeleteLeadModal && lead && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-lead-modal-title"
          aria-describedby="delete-lead-modal-description"
          onClick={() => {
            setShowDeleteLeadModal(false)
            setDeleteConfirmInput('')
          }}
        >
          <div
            className="bg-bg dark:bg-neutral-900 border border-red-200/80 dark:border-red-900/50 rounded-lg shadow-lg max-w-md w-full p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-lead-modal-title" className="text-base font-semibold mb-2 text-red-900 dark:text-red-200">
              Eliminar lead permanentemente
            </h3>
            <p id="delete-lead-modal-description" className="text-sm text-muted dark:text-neutral-400 mb-3 leading-relaxed">
              Se borrarán este lead, su historial de etapas en la app y dejarán de mostrarse las citas vinculadas (el
              evento puede quedar sin lead). Esta acción no se puede deshacer. El archivado sigue disponible si solo
              quieres ocultarlo del embudo activo.
            </p>
            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-1">
              Escribe <span className="font-mono tabular-nums">{DELETE_LEAD_CONFIRM_WORD}</span> para confirmar:
            </p>
            <input
              type="text"
              autoComplete="off"
              value={deleteConfirmInput}
              onChange={(e) => setDeleteConfirmInput(e.target.value)}
              disabled={deletingLead}
              className={`${CONTROL} mb-4 font-mono`}
              placeholder={DELETE_LEAD_CONFIRM_WORD}
              aria-label={`Confirmación: escribe ${DELETE_LEAD_CONFIRM_WORD}`}
            />
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteLeadModal(false)
                  setDeleteConfirmInput('')
                }}
                disabled={deletingLead}
                className="btn btn-ghost text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteLeadPermanent()}
                disabled={
                  deletingLead ||
                  deleteConfirmInput.trim().toUpperCase() !== DELETE_LEAD_CONFIRM_WORD
                }
                className="btn text-sm border border-red-300 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:hover:bg-red-600"
              >
                {deletingLead ? 'Eliminando…' : 'Eliminar para siempre'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Grid: columna izq. Datos+Citas+Actividad (8) | Pipeline + Oportunidad (4) */}
      <div
        className={`grid grid-cols-1 gap-3 lg:grid-cols-12 lg:gap-x-4 lg:gap-y-2 ${prefersReducedMotion ? '' : 'motion-safe:transition-[gap] duration-150'}`}
      >
        <div className="order-1 flex flex-col gap-2 lg:col-span-8">
          <div className={`${CARD_SURFACE} ${CARD_PAD} ${prefersReducedMotion ? '' : 'motion-safe:transition-shadow duration-150'}`}>
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-neutral-100 pb-2.5 dark:border-neutral-800/80">
              <h3 className={SECTION_LABEL}>Datos</h3>
            </div>
            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 md:gap-x-3 md:gap-y-2.5">
              <div>
                <label htmlFor="full_name" className={FIELD_LABEL}>
                  Nombre completo *
                </label>
                <input
                  id="full_name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={saving}
                  className={CONTROL}
                  required
                />
              </div>
              <div>
                <label htmlFor="phone_national" className={FIELD_LABEL}>
                  Teléfono
                </label>
                <div
                  className={`flex w-full min-w-0 overflow-hidden rounded-lg border border-neutral-200 bg-white transition-[border-color,box-shadow] duration-150 dark:border-neutral-600 dark:bg-neutral-900 focus-within:border-neutral-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-neutral-200/70 dark:focus-within:ring-neutral-600/40 ${saving ? 'opacity-50' : ''}`}
                >
                  <span
                    className="inline-flex shrink-0 items-center gap-1 border-r border-neutral-200 bg-neutral-50 px-2 py-1.5 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/60 dark:text-neutral-200"
                    title="México"
                  >
                    <span className="text-base leading-none" aria-hidden>
                      🇲🇽
                    </span>
                    <span className="font-medium tabular-nums tracking-tight">+52</span>
                  </span>
                  <input
                    id="phone_national"
                    type="text"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    value={phoneNationalDigits}
                    onChange={(e) => setPhoneNationalDigits(nationalPhoneDigitsOnly(e.target.value))}
                    disabled={saving}
                    placeholder="5512345678"
                    maxLength={10}
                    aria-describedby="phone_national_hint"
                    className="min-w-0 flex-1 border-0 bg-transparent py-1.5 pl-2 pr-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-0 dark:text-neutral-100 dark:placeholder:text-neutral-500"
                  />
                </div>
                <p
                  id="phone_national_hint"
                  className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400"
                >
                  10 dígitos · solo números (LADA + número)
                </p>
              </div>
              <div>
                <label htmlFor="email" className={FIELD_LABEL}>
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value.replace(/\s/g, '').replace(/[\u0000-\u001F\u007F]/g, ''))
                  }
                  disabled={saving}
                  maxLength={254}
                  className={CONTROL}
                />
              </div>
              <div>
                <label htmlFor="source" className={FIELD_LABEL}>
                  Fuente
                </label>
                <select
                  id="source"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  disabled={saving}
                  className={CONTROL}
                >
                  <option value="">Seleccionar fuente</option>
                  {SOURCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {source && source.trim().toLowerCase() === 'referido' && (
                <div>
                  <label htmlFor="referral_name" className={FIELD_LABEL}>
                    Referido por
                  </label>
                  <input
                    id="referral_name"
                    type="text"
                    value={referralName}
                    onChange={(e) => setReferralName(e.target.value)}
                    disabled={saving}
                    className={CONTROL}
                    placeholder="Nombre de quien refirió"
                  />
                </div>
              )}
              <div className="md:col-span-2">
                <label htmlFor="notes" className={FIELD_LABEL}>
                  Notas
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={saving}
                  rows={2}
                  className={`${CONTROL} resize-y min-h-[4.5rem]`}
                />
              </div>
            </div>
          </div>

          <div className={`${CARD_SURFACE} ${CARD_PAD} ${prefersReducedMotion ? '' : 'motion-safe:transition-shadow duration-150'}`}>
            <LeadAppointmentsList
              key={`${id}-${appointmentsListKey}`}
              leadId={id!}
              onRequestNewAppointment={() => setAppointmentModalOpen(true)}
            />
          </div>

          <div className={`${CARD_SURFACE} ${CARD_PAD}`}>
            <button
              type="button"
              onClick={() => setActividadExpanded((e) => !e)}
              className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border-0 bg-transparent py-2 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400"
              aria-expanded={actividadExpanded}
              aria-controls="actividad-content"
            >
              <h3 className={SECTION_LABEL}>Actividad</h3>
              <span className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400" aria-hidden>
                {!actividadExpanded && stageHistory.length > 0 && (
                  <span>{stageHistory.length} movimiento(s) de etapa</span>
                )}
                {actividadExpanded ? '▼' : '▶'}
              </span>
            </button>
            {!actividadExpanded && stageHistory.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-neutral-100 pt-2 dark:border-neutral-800/80">
                {stageHistory.slice(-3).reverse().map((h) => {
                  const fromName = h.from_stage_id ? displayStageName(stageNameById.get(h.from_stage_id)) ?? '—' : 'Inicio'
                  const toName = displayStageName(stageNameById.get(h.to_stage_id)) ?? '—'
                  const when = h.occurred_at ?? h.moved_at
                  return (
                    <div key={h.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm text-neutral-800 dark:text-neutral-200">
                      <span className="tabular-nums text-neutral-500 dark:text-neutral-400">{formatDateMX(when)}</span>
                      <span>De {fromName} → {toName}</span>
                    </div>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setActividadExpanded(true)}
                  className="mt-1 text-xs font-medium text-neutral-700 underline-offset-2 hover:underline dark:text-neutral-300"
                >
                  Ver todo
                </button>
              </div>
            )}
            {actividadExpanded && (
              <div id="actividad-content" className="mt-2 border-t border-neutral-100 pt-3 dark:border-neutral-800/80">
                {stageHistory.length > 0 ? (
                  <div className="space-y-2">
                    <p className={`${SECTION_LABEL} mb-2`}>Historial de etapas</p>
                    {stageHistory.map((h) => {
                      const fromName = h.from_stage_id ? displayStageName(stageNameById.get(h.from_stage_id)) ?? '—' : 'Inicio'
                      const toName = displayStageName(stageNameById.get(h.to_stage_id)) ?? '—'
                      const when = h.occurred_at ?? h.moved_at
                      return (
                        <div key={h.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm text-neutral-800 dark:text-neutral-200">
                          <span className="tabular-nums text-neutral-500 dark:text-neutral-400">{formatDateMX(when)}</span>
                          <span>De {fromName} → {toName}</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    Sin historial de etapas aún.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Columna derecha: Pipeline */}
        <div className="order-2 flex flex-col gap-3 self-start lg:sticky lg:top-4 lg:col-span-4">
          <div className={`${CARD_SURFACE} ${CARD_PAD}`}>
            <h3 className={`${SECTION_LABEL} mb-3 border-b border-neutral-100 pb-2 dark:border-neutral-800/80`}>
              Pipeline
            </h3>
            {moving && (
              <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">Guardando etapa…</p>
            )}
            <div>
              <label htmlFor="stage_select" className={FIELD_LABEL}>
                Etapa actual
              </label>
              {lead.archived_at ? (
                <p className="py-1.5 text-sm text-neutral-500 dark:text-neutral-400">Restaura el lead para editar la etapa.</p>
              ) : (
                <>
                  <select
                    id="stage_select"
                    value={selectedStageId}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v && v !== lead.stage_id) handleStageSelectChange(v)
                      else setSelectedStageId(v)
                    }}
                    disabled={moving || stages.length === 0}
                    className={CONTROL}
                  >
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        {displayStageName(stage.name)}
                      </option>
                    ))}
                  </select>
                  {pendingStageId && !moving && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-700/50 dark:bg-amber-900/20">
                      <span className="flex-1 text-xs text-amber-800 dark:text-amber-300">
                        ¿Mover a <strong>{displayStageName(stages.find((s) => s.id === pendingStageId)?.name)}</strong>?
                      </span>
                      <button
                        type="button"
                        onClick={confirmStageChange}
                        className="shrink-0 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={cancelStageChange}
                        className="shrink-0 rounded-md border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300 transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="mt-3">
              <label htmlFor="pipeline_temperature" className={FIELD_LABEL}>
                Temperatura (interés)
              </label>
              <p className="mb-1.5 text-[11px] leading-snug text-neutral-500 dark:text-neutral-400">
                Interés del lead; distinto de la fuente de captación.
              </p>
              {lead.archived_at ? (
                <p className="py-1 text-sm text-neutral-500 dark:text-neutral-400">—</p>
              ) : (
                <select
                  id="pipeline_temperature"
                  value={lead.temperature ?? ''}
                  onChange={handlePipelineTemperatureChange}
                  disabled={moving || saving || savingTemperature || stages.length === 0}
                  className={CONTROL}
                  title="Clasificación de interés: frío, tibio o caliente. Independiente del campo Fuente."
                >
                  <option value="">Sin clasificar</option>
                  <option value="frio">Frío</option>
                  <option value="tibio">Tibio</option>
                  <option value="caliente">Caliente</option>
                </select>
              )}
              {savingTemperature ? (
                <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Guardando…</p>
              ) : null}
            </div>
            <div className="mt-4 border-t border-neutral-100 pt-3 dark:border-neutral-800/80">
              <p className={`${SECTION_LABEL} mb-2`}>Tiempos</p>
              <dl className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-400">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0">En etapa actual</dt>
                  <dd className="tabular-nums font-medium text-neutral-900 dark:text-neutral-100">
                    {enteredCurrentStageAt ? `${Math.floor(diffDaysFloor(enteredCurrentStageAt, new Date()))} d` : '—'}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="shrink-0">Desde creación</dt>
                  <dd className="tabular-nums font-medium text-neutral-900 dark:text-neutral-100">
                    {lead.created_at ? `${Math.floor(diffDaysFloor(lead.created_at, new Date()))} d` : '—'}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="my-3 h-px bg-neutral-100 dark:bg-neutral-800/80" />
            <div className="flex flex-col gap-1 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
              <div>Creado · {formatDateTime(lead.created_at)}</div>
              <div>Actualizado · {formatDateTime(lead.updated_at)}</div>
              {lead.stage_changed_at && (
                <div>Último cambio de etapa · {formatDateTime(lead.stage_changed_at)}</div>
              )}
            </div>
          </div>

          <div className={`${CARD_SURFACE} ${CARD_PAD}`}>
            <h3 className={`${SECTION_LABEL} mb-3 border-b border-neutral-100 pb-2 dark:border-neutral-800/80`}>
              Oportunidad
            </h3>
            <div className="space-y-2.5">
              <div>
                <label htmlFor="estimated_value" className={FIELD_LABEL}>
                  Valor estimado
                </label>
                {lead.archived_at ? (
                  <p className="py-1 text-sm text-neutral-600 dark:text-neutral-400">{formatCurrencyMXN(lead.estimated_value)}</p>
                ) : (
                  <input
                    id="estimated_value"
                    type="number"
                    min={0}
                    step={1}
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(e.target.value)}
                    onBlur={handleSaveOpportunity}
                    disabled={savingOpportunity}
                    placeholder="0"
                    className={`${CONTROL} tabular-nums`}
                  />
                )}
              </div>
              <div>
                <label htmlFor="expected_close_at" className={FIELD_LABEL}>
                  Cierre esperado
                </label>
                {lead.archived_at ? (
                  <p className="py-1 text-sm text-neutral-600 dark:text-neutral-400">
                    {lead.expected_close_at
                      ? formatDateMX(lead.expected_close_at)
                      : '—'}
                  </p>
                ) : (
                  <input
                    id="expected_close_at"
                    type="date"
                    value={expectedCloseAt}
                    onChange={(e) => setExpectedCloseAt(e.target.value)}
                    onBlur={handleSaveOpportunity}
                    disabled={savingOpportunity}
                    className={CONTROL}
                  />
                )}
              </div>
              <div>
                <label className={FIELD_LABEL}>Owner</label>
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900/50 dark:text-neutral-100">
                  {ownerDisplayName ?? (lead.owner_user_id ? '…' : '—')}
                </div>
              </div>
              {savingOpportunity && (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">Guardando…</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>

    <MoveBackwardConfirmDialog
      isOpen={backwardConfirmToStageId != null && lead != null}
      leadDisplayName={lead.full_name?.trim() || 'Este contacto'}
      currentStageName={displayStageName(
        stages.find((s) => s.id === lead.stage_id)?.name || 'Etapa actual'
      )}
      targetStageName={displayStageName(
        stages.find((s) => s.id === (backwardConfirmToStageId ?? ''))?.name || 'Etapa'
      )}
      onCancel={() => {
        setBackwardConfirmToStageId(null)
        if (lead) setSelectedStageId(lead.stage_id)
      }}
      onConfirm={() => {
        const to = backwardConfirmToStageId
        setBackwardConfirmToStageId(null)
        if (to) void handleMoveStage(to)
      }}
    />

    <AppointmentFormModal
      key={`lead-appt-create-${id}`}
      isOpen={appointmentModalOpen}
      onClose={() => setAppointmentModalOpen(false)}
      mode="create"
      onSaved={() => {
        setAppointmentsListKey((k) => k + 1)
        setAppointmentModalOpen(false)
      }}
      initialLeadId={id ?? null}
      createDefaults={{ durationMinutes: 30 }}
    />
    </>
  )
}
