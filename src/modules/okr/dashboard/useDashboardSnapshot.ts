/**
 * Helper para copiar snapshot del dashboard al clipboard (solo DEV)
 */

const IS_DEV = import.meta.env.DEV

export interface DashboardSnapshot {
  mode: 'owner' | 'manager'
  weekStartLocal: string
  weekEndLocal: string
  weeklyTarget: number
  dailyTarget: number
  weeklyDays: number
  advisorIds: string[]
  timestamp: string
}

export function useDashboardSnapshot() {
  const copySnapshot = async (
    mode: 'owner' | 'manager',
    weekStartLocal: string,
    weekEndLocal: string,
    weeklyTarget: number,
    dailyTarget: number,
    weeklyDays: number,
    advisorIds: string[]
  ): Promise<boolean> => {
    if (!IS_DEV) return false

    const snapshot: DashboardSnapshot = {
      mode,
      weekStartLocal,
      weekEndLocal,
      weeklyTarget,
      dailyTarget,
      weeklyDays,
      advisorIds,
      timestamp: new Date().toISOString(),
    }

    try {
      await navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2))
      return true
    } catch (err) {
      console.error('[useDashboardSnapshot] Error al copiar:', err)
      return false
    }
  }

  return { copySnapshot }
}
