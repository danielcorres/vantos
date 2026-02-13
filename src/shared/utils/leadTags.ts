/**
 * Tags por etapa (principal derivado) y condición (secundario guardado en DB).
 * Un solo lugar para la lógica; colores consistentes.
 */

export type LeadTagTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'violet'
  | 'indigo'
  | 'emerald'
  | 'rose'
  | 'slate'
  | 'amber'
  | 'orange'

export type LeadTag = {
  label: string
  tone: LeadTagTone
  kind: 'main' | 'condition'
}

export type LeadForTags = {
  last_contact_outcome?: string | null
  quote_status?: string | null
  close_outcome?: string | null
  requirements_status?: string | null
  application_status?: string | null
}

const STAGE_CONTACTOS_NUEVOS = 'Contactos Nuevos'
const STAGE_CITAS_AGENDADAS = 'Citas Agendadas'
const STAGE_CASOS_ABIERTOS = 'Casos Abiertos'
const STAGE_CITAS_CIERRE = 'Citas de Cierre'
const STAGE_SOLICITUDES = 'Solicitudes Ingresadas'
const STAGE_CASOS_GANADOS = 'Casos Ganados'

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

/**
 * Tag principal por etapa (derivado; no se guarda en DB).
 * stageName = pipeline_stages.name exacto.
 */
export function getLeadMainTag(
  lead: LeadForTags,
  stageName: string | undefined
): LeadTag {
  const stage = (stageName ?? '').trim()

  if (stage === STAGE_CONTACTOS_NUEVOS) {
    const o = norm(lead.last_contact_outcome)
    if (o === 'none' || o === '') return { label: 'Sin intento', tone: 'slate', kind: 'main' }
    if (o === 'no_answer') return { label: 'No respondió', tone: 'warning', kind: 'main' }
    if (o === 'voicemail') return { label: 'Buzón', tone: 'indigo', kind: 'main' }
    if (o === 'connected') return { label: 'Contestó', tone: 'emerald', kind: 'main' }
    return { label: 'Sin intento', tone: 'slate', kind: 'main' }
  }

  if (stage === STAGE_CITAS_AGENDADAS) {
    return { label: 'En seguimiento', tone: 'info', kind: 'main' }
  }

  if (stage === STAGE_CASOS_ABIERTOS) {
    const q = norm(lead.quote_status)
    if (q === 'pending') return { label: 'Cotización pendiente', tone: 'warning', kind: 'main' }
    if (q === 'done') return { label: 'Cotización realizada', tone: 'emerald', kind: 'main' }
    if (q === 'none' || q === '') return { label: 'En seguimiento', tone: 'info', kind: 'main' }
    return { label: 'En seguimiento', tone: 'info', kind: 'main' }
  }

  if (stage === STAGE_CITAS_CIERRE) {
    const c = norm(lead.close_outcome)
    if (c === 'none' || c === '') return { label: 'Cierre pendiente', tone: 'violet', kind: 'main' }
    if (c === 'done') return { label: 'Cierre realizado', tone: 'emerald', kind: 'main' }
    if (c === 'no_show') return { label: 'No se presentó', tone: 'rose', kind: 'main' }
    return { label: 'Cierre pendiente', tone: 'violet', kind: 'main' }
  }

  if (stage === STAGE_SOLICITUDES) {
    const ra = norm(lead.requirements_status)
    const app = norm(lead.application_status)
    if (ra === 'ra') return { label: 'En RA', tone: 'orange', kind: 'main' }
    if (app === 'signed') return { label: 'Firmado', tone: 'emerald', kind: 'main' }
    if (app === 'submitted') return { label: 'Falta firma', tone: 'amber', kind: 'main' }
    return { label: 'Solicitud pendiente', tone: 'slate', kind: 'main' }
  }

  if (stage === STAGE_CASOS_GANADOS) {
    return { label: 'Ganado', tone: 'emerald', kind: 'main' }
  }

  return { label: 'En seguimiento', tone: 'info', kind: 'main' }
}

const CONDITION_LABELS: Record<string, string> = {
  waiting_client: 'Esperando cliente',
  docs_pending: 'Pendiente docs',
  paused: 'En pausa',
  budget: 'Sin presupuesto',
  unreachable: 'No localizable',
}

/**
 * Tag secundario (lead_condition guardado en DB). Solo mostrar en Tabla.
 */
export function getLeadConditionTag(lead: {
  lead_condition?: string | null
}): LeadTag | null {
  const c = (lead.lead_condition ?? '').trim()
  if (!c || !CONDITION_LABELS[c]) return null
  const isNegative = c === 'budget' || c === 'unreachable'
  return {
    label: CONDITION_LABELS[c],
    tone: isNegative ? 'danger' : 'neutral',
    kind: 'condition',
  }
}

const TONE_CLASSES: Record<LeadTagTone, string> = {
  neutral: 'bg-neutral-100 text-neutral-700 ring-neutral-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  danger: 'bg-rose-50 text-rose-700 ring-rose-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rose: 'bg-rose-50 text-rose-700 ring-rose-200',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200',
}

export function getTagClass(tag: LeadTag): string {
  const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1'
  return `${base} ${TONE_CLASSES[tag.tone]}`
}

/**
 * Borde rojo para fila/card en Tabla cuando lead_condition es budget o unreachable.
 */
export function getRowBorderClassFromCondition(lead: {
  lead_condition?: string | null
}): string {
  const c = (lead.lead_condition ?? '').trim()
  if (c === 'budget' || c === 'unreachable') return 'border-l-4 border-l-rose-500'
  return ''
}
