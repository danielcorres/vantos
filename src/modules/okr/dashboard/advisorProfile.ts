/**
 * Helper para clasificar el perfil de un asesor basado en su actividad semanal
 * Clasifica en: Productivo, En crecimiento, Intermitente, Inactivo
 */

export type AdvisorProfileKey = 'productive' | 'growing' | 'intermittent' | 'inactive'

export type AdvisorProfileResult = {
  key: AdvisorProfileKey
  label: string
  tone: 'success' | 'info' | 'warning' | 'danger'
  shortHelp: string
  reasons: string[] // 2-3 bullets concretos para tooltip
  missing: Array<{ metricKey: string; current: number; min: number }> // top 2 faltantes vs mínimos
}

export interface BuildAdvisorProfileArgs {
  pointsWeek: number
  percentOfGoal: number | null
  daysActive: number | null
  metrics: Record<string, number> // week totals por métrica
  minimums: Record<string, number> // mínimos por asesor
}

/**
 * Construir perfil del asesor basado en actividad semanal
 */
export function buildAdvisorProfile(args: BuildAdvisorProfileArgs): AdvisorProfileResult {
  const { pointsWeek, percentOfGoal, daysActive, metrics, minimums } = args

  // Métricas de empuje (actividad base)
  const pushMetrics = [
    'calls',
    'meetings_set',
    'meetings_held',
    'proposals_presented',
    'applications_submitted',
    'referrals',
    'policies_paid',
  ] as const

  // Calcular cumplimiento por métrica
  const metricCompliance: Array<{ metricKey: string; ratio: number; current: number; min: number }> = []
  pushMetrics.forEach((metricKey) => {
    const current = metrics[metricKey] || 0
    const min = minimums[metricKey] || 0
    const ratio = min > 0 ? current / min : 1 // Si min=0, considerar cumplida
    metricCompliance.push({ metricKey, ratio, current, min })
  })

  // Filtrar métricas con mínimo > 0 para cálculos
  const metricsWithMinimum = metricCompliance.filter((m) => m.min > 0)
  const metricsMet = metricsWithMinimum.filter((m) => m.ratio >= 1.0).length
  const totalMetricsWithMin = metricsWithMinimum.length

  // Verificar si todas las métricas de empuje están en 0
  const allPushMetricsZero = pushMetrics.every((key) => (metrics[key] || 0) === 0)

  // Calcular métricas faltantes (top 2)
  const missingMetrics = metricsWithMinimum
    .filter((m) => m.ratio < 1.0)
    .sort((a, b) => a.ratio - b.ratio) // Ordenar por ratio ascendente (peor primero)
    .slice(0, 2)
    .map((m) => ({
      metricKey: m.metricKey,
      current: m.current,
      min: m.min,
    }))

  // REGLA A: INACTIVO
  if (pointsWeek === 0 || allPushMetricsZero) {
    return {
      key: 'inactive',
      label: 'Inactivo',
      tone: 'danger',
      shortHelp: 'No hay actividad registrada esta semana.',
      reasons: pointsWeek === 0 ? ['0 puntos esta semana'] : ['Sin eventos de actividad'],
      missing: missingMetrics,
    }
  }

  // REGLA B: INTERMITENTE
  const isIntermittent =
    (daysActive !== null && daysActive <= 2) || (totalMetricsWithMin > 0 && metricsMet <= 2)

  if (isIntermittent) {
    const reasons: string[] = []
    if (daysActive !== null && daysActive <= 2) {
      reasons.push(`${daysActive} día${daysActive !== 1 ? 's' : ''} con actividad`)
    }
    if (totalMetricsWithMin > 0) {
      reasons.push(`Cumple ${metricsMet}/${totalMetricsWithMin} mínimos`)
    }
    if (missingMetrics.length > 0) {
      const topMissing = missingMetrics[0]
      const diff = topMissing.min - topMissing.current
      reasons.push(`Faltan ${diff} ${topMissing.metricKey} para el mínimo`)
    }

    return {
      key: 'intermittent',
      label: 'Intermitente',
      tone: 'warning',
      shortHelp: 'Tiene días activos, pero no sostiene el ritmo.',
      reasons: reasons.length > 0 ? reasons : ['Ritmo irregular'],
      missing: missingMetrics,
    }
  }

  // Métricas clave para "en crecimiento" (actividad sólida)
  const keyActivityMetrics = ['calls', 'meetings_set', 'meetings_held', 'proposals_presented'] as const
  const keyActivityCompliance = keyActivityMetrics
    .map((key) => {
      const current = metrics[key] || 0
      const min = minimums[key] || 0
      return min > 0 ? current / min : 1
    })
    .filter((ratio) => ratio >= 1.0).length

  // Verificar conversión (resultados)
  const applicationsMin = minimums['applications_submitted'] || 0
  const policiesMin = minimums['policies_paid'] || 0
  const applicationsMet = applicationsMin > 0 ? (metrics['applications_submitted'] || 0) >= applicationsMin : false
  const policiesMet = policiesMin > 0 ? (metrics['policies_paid'] || 0) >= policiesMin : false
  const hasConversion = applicationsMet || policiesMet || (percentOfGoal !== null && percentOfGoal >= 0.8)

  // REGLA C: EN CRECIMIENTO
  if (keyActivityCompliance >= 3 && !hasConversion) {
    const reasons: string[] = []
    reasons.push(`Cumple ${keyActivityCompliance}/4 métricas clave de actividad`)
    if (applicationsMin > 0 && !applicationsMet) {
      const current = metrics['applications_submitted'] || 0
      reasons.push(`Faltan ${applicationsMin - current} solicitudes para el mínimo`)
    } else if (policiesMin > 0 && !policiesMet) {
      const current = metrics['policies_paid'] || 0
      reasons.push(`Faltan ${policiesMin - current} pólizas para el mínimo`)
    } else if (percentOfGoal !== null && percentOfGoal < 0.8) {
      reasons.push(`Meta semanal: ${Math.round(percentOfGoal * 100)}%`)
    }

    return {
      key: 'growing',
      label: 'En crecimiento',
      tone: 'info',
      shortHelp: 'Trae actividad sólida; falta convertir a resultados.',
      reasons,
      missing: missingMetrics,
    }
  }

  // REGLA D: PRODUCTIVO
  // Debe cumplir calls, meetings_set, meetings_held Y tener conversión
  const callsMet = (minimums['calls'] || 0) === 0 || (metrics['calls'] || 0) >= (minimums['calls'] || 0)
  const meetingsSetMet =
    (minimums['meetings_set'] || 0) === 0 || (metrics['meetings_set'] || 0) >= (minimums['meetings_set'] || 0)
  const meetingsHeldMet =
    (minimums['meetings_held'] || 0) === 0 || (metrics['meetings_held'] || 0) >= (minimums['meetings_held'] || 0)

  if (callsMet && meetingsSetMet && meetingsHeldMet && hasConversion) {
    const reasons: string[] = []
    reasons.push('Cumple métricas clave de actividad')
    if (applicationsMet) {
      reasons.push(`Cumple mínimo de solicitudes (${metrics['applications_submitted'] || 0})`)
    } else if (policiesMet) {
      reasons.push(`Cumple mínimo de pólizas (${metrics['policies_paid'] || 0})`)
    } else if (percentOfGoal !== null && percentOfGoal >= 0.8) {
      reasons.push(`Meta semanal: ${Math.round(percentOfGoal * 100)}%`)
    }

    return {
      key: 'productive',
      label: 'Productivo',
      tone: 'success',
      shortHelp: 'Actividad constante y avance en resultados.',
      reasons,
      missing: missingMetrics,
    }
  }

  // Fallback: si no cumple productivo pero tiene buena actividad, es "en crecimiento"
  if (keyActivityCompliance >= 2) {
    return {
      key: 'growing',
      label: 'En crecimiento',
      tone: 'info',
      shortHelp: 'Trae actividad sólida; falta convertir a resultados.',
      reasons: [`Cumple ${keyActivityCompliance}/4 métricas clave`, 'Falta mejorar conversión'],
      missing: missingMetrics,
    }
  }

  // Fallback final: intermitente
  return {
    key: 'intermittent',
    label: 'Intermitente',
    tone: 'warning',
    shortHelp: 'Tiene días activos, pero no sostiene el ritmo.',
    reasons: ['Ritmo irregular', `Cumple ${metricsMet}/${totalMetricsWithMin} mínimos`],
    missing: missingMetrics,
  }
}
