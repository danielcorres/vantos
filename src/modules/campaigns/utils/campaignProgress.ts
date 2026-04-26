import type {
  DashboardEntry,
  DashboardLevelSummary,
  AwardStatus,
  CampaignType,
} from '../domain/types'

// ─── Progreso numérico ─────────────────────────────────────────────────────────

/**
 * Porcentaje de avance hacia el siguiente nivel (0-100).
 * Si ya alcanzó el máximo retorna 100.
 */
export function getProgressPercent(entry: DashboardEntry): number {
  if (entry.is_max_reached || !entry.next_level) return 100

  const from = entry.current_level?.target_value ?? 0
  const to = entry.next_level.target_value
  const val = entry.value

  if (to <= from) return 100
  return Math.min(100, Math.round(((val - from) / (to - from)) * 100))
}

/**
 * Unidades restantes para el siguiente nivel.
 * Retorna 0 si ya alcanzó el máximo.
 */
export function getRemainingToNextLevel(entry: DashboardEntry): number {
  if (entry.is_max_reached || !entry.next_level) return 0
  return Math.max(0, entry.next_level.target_value - entry.value)
}

/**
 * Texto del nivel actual (o "Sin nivel" si aún no alcanzó ninguno).
 */
export function getCurrentLevelLabel(entry: DashboardEntry): string {
  if (!entry.current_level) return 'Sin nivel'
  return entry.current_level.name
}

/**
 * Texto del siguiente nivel a alcanzar.
 */
export function getNextLevelLabel(entry: DashboardEntry): string | null {
  if (entry.is_max_reached || !entry.next_level) return null
  return entry.next_level.name
}

// ─── Pace / ritmo mensual ─────────────────────────────────────────────────────

/**
 * Estima el mes actual dentro del periodo para campañas mensuales (YYYY-MM).
 * Para otros formatos retorna null.
 */
export function getCurrentMonthInPeriod(periodo: string): number | null {
  if (!/^\d{4}-\d{2}$/.test(periodo)) return null
  const now = new Date()
  return now.getDate()
}

/**
 * Para campañas de carrera: indica en qué mes de la campaña está el asesor.
 */
export function getAdvisorCampaignMonthLabel(entry: DashboardEntry): string | null {
  if (entry.advisor_campaign_month == null) return null
  return `Mes ${entry.advisor_campaign_month}`
}

// ─── Nivel objetivo para campañas de carrera ──────────────────────────────────

/**
 * Para new_advisor_path: devuelve el nivel esperado según el mes actual
 * del asesor en la campaña.
 */
export function getExpectedLevelForMonth(
  levels: DashboardLevelSummary[],
  advisorMonth: number | null
): DashboardLevelSummary | null {
  if (advisorMonth == null) return null
  const sorted = [...levels].sort((a, b) => a.level_order - b.level_order)
  let expected: DashboardLevelSummary | null = null
  for (const lvl of sorted) {
    if (lvl.target_month != null && lvl.target_month <= advisorMonth) {
      expected = lvl
    }
  }
  return expected
}

// ─── Condiciones del nivel ─────────────────────────────────────────────────────

export interface LevelCondition {
  key: string
  label: string
  required: boolean
  description?: string
}

export function getLevelConditions(level: DashboardLevelSummary): LevelCondition[] {
  const conditions: LevelCondition[] = []

  if (level.requires_monthly_minimum) {
    conditions.push({
      key: 'monthly_minimum',
      label: 'Mínimo mensual requerido',
      required: true,
      description: level.monthly_minimum_description ?? undefined,
    })
  }
  if (level.requires_active_group) {
    conditions.push({
      key: 'active_group',
      label: 'Grupo activo requerido',
      required: true,
    })
  }
  if (level.requires_inforce_ratio) {
    conditions.push({
      key: 'inforce_ratio',
      label: `Índice de persistencia ≥ ${level.minimum_inforce_ratio ?? '–'}%`,
      required: true,
    })
  }
  if (level.requires_limra_index) {
    conditions.push({
      key: 'limra_index',
      label: 'Índice LIMRA requerido',
      required: true,
    })
  }
  if (level.validation_notes) {
    conditions.push({
      key: 'notes',
      label: level.validation_notes,
      required: false,
    })
  }

  return conditions
}

export function levelHasConditions(level: DashboardLevelSummary): boolean {
  return (
    level.requires_monthly_minimum ||
    level.requires_active_group ||
    level.requires_inforce_ratio ||
    level.requires_limra_index
  )
}

// ─── Etiquetas de status de premio ────────────────────────────────────────────

const AWARD_STATUS_LABEL: Record<AwardStatus, string> = {
  projected:          'En camino',
  eligible:           'Elegible',
  pending_validation: 'En validación',
  earned:             'Ganado',
  confirmed:          'Confirmado',
  delivered:          'Entregado',
  lost:               'No cumplido',
  recovered:          'Recuperado',
  cancelled:          'Cancelado',
}

export function getAwardStatusLabel(status: AwardStatus | null | undefined): string {
  if (!status) return '–'
  return AWARD_STATUS_LABEL[status] ?? status
}

const AWARD_STATUS_COLOR: Record<AwardStatus, string> = {
  projected:          'text-blue-600 bg-blue-50',
  eligible:           'text-emerald-600 bg-emerald-50',
  pending_validation: 'text-amber-600 bg-amber-50',
  earned:             'text-green-700 bg-green-100',
  confirmed:          'text-green-800 bg-green-200',
  delivered:          'text-teal-700 bg-teal-100',
  lost:               'text-red-600 bg-red-50',
  recovered:          'text-purple-600 bg-purple-50',
  cancelled:          'text-zinc-400 bg-zinc-100',
}

export function getAwardStatusColor(status: AwardStatus | null | undefined): string {
  if (!status) return 'text-zinc-400 bg-zinc-100'
  return AWARD_STATUS_COLOR[status] ?? 'text-zinc-400 bg-zinc-100'
}

// Transiciones válidas de status (para UI)
const VALID_TRANSITIONS: Record<AwardStatus, AwardStatus[]> = {
  projected:          ['eligible', 'lost', 'cancelled'],
  eligible:          ['pending_validation', 'earned', 'lost', 'cancelled'],
  pending_validation: ['earned', 'lost', 'cancelled'],
  earned:             ['confirmed', 'cancelled'],
  confirmed:          ['delivered', 'cancelled'],
  delivered:          ['cancelled'],
  lost:               ['recovered', 'cancelled'],
  recovered:          ['confirmed', 'cancelled'],
  cancelled:          [],
}

export function getValidNextStatuses(current: AwardStatus): AwardStatus[] {
  return VALID_TRANSITIONS[current] ?? []
}

// ─── Tipo de campaña — etiquetas ──────────────────────────────────────────────

const CAMPAIGN_TYPE_LABEL: Record<CampaignType, string> = {
  monthly:          'Mensual',
  new_advisor_path: 'Carrera de asesor',
  multi_track:      'Multi-camino',
  ranking:          'Ranking',
}

export function getCampaignTypeLabel(type: CampaignType): string {
  return CAMPAIGN_TYPE_LABEL[type] ?? type
}

// ─── Formato de periodo ───────────────────────────────────────────────────────

export function formatPeriodo(periodo: string): string {
  if (/^\d{4}-\d{2}$/.test(periodo)) {
    const [year, month] = periodo.split('-')
    const d = new Date(Number(year), Number(month) - 1, 1)
    return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'long' })
  }
  if (/^\d{4}-H[12]$/.test(periodo)) {
    const [year, h] = periodo.split('-')
    return `${h === 'H1' ? '1er semestre' : '2do semestre'} ${year}`
  }
  if (/^\d{4}-Q[1-4]$/.test(periodo)) {
    const [year, q] = periodo.split('-')
    return `${q} ${year}`
  }
  if (/^\d{4}$/.test(periodo)) return `Año ${periodo}`
  return periodo
}

// ─── Utilidades de valor ──────────────────────────────────────────────────────

export function formatValue(value: number, unitLabel?: string): string {
  const formatted = value % 1 === 0 ? value.toString() : value.toFixed(1)
  return unitLabel ? `${formatted} ${unitLabel}` : formatted
}
