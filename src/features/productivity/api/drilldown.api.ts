import { supabase } from '../../../lib/supabaseClient'
import type { StageSlug } from '../types/productivity.types'
import type { WeeklyEntryLead } from '../types/productivity.types'

export async function getWeeklyEntryLeads(
  weekStartYmd: string,
  stageSlug: StageSlug
): Promise<WeeklyEntryLead[]> {
  const { data, error } = await supabase.rpc('get_weekly_pipeline_entries_leads', {
    p_week_start: weekStartYmd,
    p_stage_slug: stageSlug,
  })

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as Array<{
    lead_id: string
    lead_name: string | null
    next_follow_up_at: string | null
    source: string | null
    moved_at: string
    stage_slug: string
  }>

  return rows.map((row) => ({
    lead_id: row.lead_id,
    lead_name: row.lead_name ?? null,
    moved_at: row.moved_at,
    next_follow_up_at: row.next_follow_up_at ?? null,
    source: row.source ?? null,
  }))
}
