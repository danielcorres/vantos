/**
 * Estados semánticos de seguimiento (next_follow_up_at) para UI enterprise.
 * Sustituye "Próx: Hoy" + semáforo por labels claros y microcopy con fecha.
 */

import { todayLocalYmd, daysBetweenYmd } from './dates'

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

function formatProxDate(dateString: string | null | undefined): string {
  if (!dateString) return '—'
  try {
    const ymd = dateString.split('T')[0]
    const today = todayLocalYmd()
    if (ymd === today) return 'Hoy'
    const [, m, d] = ymd.split('-').map(Number)
    return `${d} ${MONTHS[m - 1]}`
  } catch {
    return '—'
  }
}

export type FollowUpDisplay = {
  labelPrimary: string
  labelSecondary: string
  classes: string
}

/**
 * Devuelve label principal, microcopy con fecha y clases para el texto principal.
 * Usa next_follow_up_at y "hoy" local. Sin dots/semáforos.
 */
export function getFollowUpDisplay(nextFollowUpAt: string | null | undefined): FollowUpDisplay {
  const today = todayLocalYmd()
  const secondarySuffix = formatProxDate(nextFollowUpAt)

  if (!nextFollowUpAt || !nextFollowUpAt.trim()) {
    return {
      labelPrimary: 'Sin seguimiento',
      labelSecondary: '—',
      classes: 'text-neutral-500',
    }
  }

  const followUpYmd = nextFollowUpAt.split('T')[0]
  const daysFromToday = daysBetweenYmd(today, followUpYmd)

  if (daysFromToday < 0) {
    return {
      labelPrimary: 'Vencido · Seguimiento pendiente',
      labelSecondary: `Próx. seguimiento: ${secondarySuffix}`,
      classes: 'text-emerald-700',
    }
  }

  if (daysFromToday === 0) {
    return {
      labelPrimary: 'Hoy · Seguimiento pendiente',
      labelSecondary: 'Próx. seguimiento: Hoy',
      classes: 'text-emerald-700',
    }
  }

  if (daysFromToday >= 1 && daysFromToday <= 3) {
    return {
      labelPrimary: 'En curso · Seguimiento activo',
      labelSecondary: `Próx. seguimiento: ${secondarySuffix}`,
      classes: 'text-sky-700',
    }
  }

  // 4+ días
  return {
    labelPrimary: 'Programado',
    labelSecondary: `Próx. seguimiento: ${secondarySuffix}`,
    classes: 'text-neutral-600',
  }
}
