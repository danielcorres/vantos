import { supabase } from '../../../lib/supabaseClient'
import type { WeeklyProductivity, StageSlug } from '../types/productivity.types'
import { STAGE_SLUGS_ORDER } from '../types/productivity.types'

const KNOWN_SLUGS = new Set<string>(STAGE_SLUGS_ORDER)

function emptyCounts(): Record<StageSlug, number> {
  const r = {} as Record<StageSlug, number>
  for (const slug of STAGE_SLUGS_ORDER) {
    r[slug] = 0
  }
  return r
}

export async function getWeeklyProductivity(weekStartYmd: string): Promise<WeeklyProductivity> {
  const { data, error } = await supabase.rpc('get_weekly_pipeline_entries', {
    p_week_start: weekStartYmd,
  })

  if (error) throw new Error(error.message)

  const counts = emptyCounts()
  const rows = (data ?? []) as Array<{ slug: string; count: number }>

  for (const row of rows) {
    if (KNOWN_SLUGS.has(row.slug)) {
      counts[row.slug as StageSlug] = Number(row.count) || 0
    }
  }

  const [y, m, d] = weekStartYmd.split('-').map(Number)
  const endDate = new Date(y, m - 1, d)
  endDate.setDate(endDate.getDate() + 7)
  const weekEndExclusiveYmd = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`

  return {
    weekStartYmd,
    weekEndExclusiveYmd,
    counts,
  }
}
