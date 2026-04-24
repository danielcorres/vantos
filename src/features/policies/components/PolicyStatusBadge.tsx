import { todayLocalYmd } from '../../../shared/utils/dates'

type PolicyStatusBadgeProps = {
  endDateYmd: string
}

/** Vigente si end_date >= hoy (zona local), si no Vencida. */
export function PolicyStatusBadge({ endDateYmd }: PolicyStatusBadgeProps) {
  const today = todayLocalYmd()
  const vencida = endDateYmd < today
  if (vencida) {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-200">
        Vencida
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/50 dark:text-emerald-200">
      Vigente
    </span>
  )
}
