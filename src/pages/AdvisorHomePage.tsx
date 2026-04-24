import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../shared/auth/AuthProvider'
import { getMyProfile } from '../lib/profile'
import { supabase } from '../lib/supabase'
import { pipelineApi, type Lead, type PipelineStage } from '../features/pipeline/pipeline.api'
import { calendarApi } from '../features/calendar/api/calendar.api'
import type { CalendarEvent } from '../features/calendar/types/calendar.types'
import { fetchWeeklyMinimumTargetsForOwner } from '../modules/okr/dashboard/weeklyMinimumTargets'
import {
  getMondayOfWeekYmd,
  startOfTodayMonterreyISO,
  timestampToYmdInTz,
  todayLocalYmd,
} from '../shared/utils/dates'
import { getWeeklyProductivity } from '../features/productivity/api/productivity.api'
import type { StageSlug } from '../features/productivity/types/productivity.types'
import type { LeadSchedulingSummary } from '../features/calendar/utils/stageSchedulingGuidance'
import { resolveCalModalFromGuidance } from '../features/pipeline/utils/resolveCalModalFromGuidance'
import { AppointmentFormModal } from '../features/calendar/components/AppointmentFormModal'
import type { AppointmentType } from '../features/calendar/types/calendar.types'
import { Toast } from '../shared/components/Toast'
import {
  fetchMilestonePolicyCounts,
  type AdvisorMilestoneProfile,
  type MilestonePolicyCounts,
} from '../modules/advisors/data/advisorMilestones.api'
import { getAdvisorMilestoneStatus } from '../modules/advisors/domain/advisorMilestones'
import { AdvisorHubHeader } from '../features/advisor-hub/components/AdvisorHubHeader'
import { AdvisorHubTodayCard } from '../features/advisor-hub/components/AdvisorHubTodayCard'
import { AdvisorHubUrgentLeadsCard } from '../features/advisor-hub/components/AdvisorHubUrgentLeadsCard'
import { AdvisorHubPipelinePhasesCard } from '../features/advisor-hub/components/AdvisorHubPipelinePhasesCard'
import { AdvisorHubMilestones12mCard } from '../features/advisor-hub/components/AdvisorHubMilestones12mCard'

type CalModalState =
  | null
  | {
      mode: 'create'
      leadId: string
      initialAppointmentType?: AppointmentType | null
      initialTitle?: string | null
      lockType?: AppointmentType | null
      helpText?: string | null
    }
  | {
      mode: 'edit'
      leadId: string
      event: CalendarEvent
      helpText?: string | null
    }

async function batchNextByLeadIds(leadIds: string[]): Promise<Record<string, CalendarEvent | null>> {
  const chunk = 200
  const out: Record<string, CalendarEvent | null> = {}
  for (let i = 0; i < leadIds.length; i += chunk) {
    const slice = leadIds.slice(i, i + chunk)
    const part = await calendarApi.getNextScheduledEventByLeadIds(slice)
    Object.assign(out, part)
  }
  return out
}

export function AdvisorHomePage() {
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [stages, setStages] = useState<PipelineStage[]>([])
  const [weeklyEntryCountsBySlug, setWeeklyEntryCountsBySlug] = useState<Record<StageSlug, number>>(
    () => ({}) as Record<StageSlug, number>
  )
  const [hubWeekStartYmd, setHubWeekStartYmd] = useState('')
  const [targetsMap, setTargetsMap] = useState<
    Awaited<ReturnType<typeof fetchWeeklyMinimumTargetsForOwner>>['targets']
  >({} as never)

  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([])
  const [eventLeadNames, setEventLeadNames] = useState<Record<string, string>>({})

  const [activosLeads, setActivosLeads] = useState<Lead[]>([])
  const [nextByLeadId, setNextByLeadId] = useState<Record<string, CalendarEvent | null>>({})
  const [schedulingSummaryByLeadId, setSchedulingSummaryByLeadId] = useState<
    Record<string, LeadSchedulingSummary>
  >({})

  const [myAdvisorStatus, setMyAdvisorStatus] = useState<string | null>(null)
  const [myKeyActivation, setMyKeyActivation] = useState<string | null>(null)
  const [myConnectionDate, setMyConnectionDate] = useState<string | null>(null)
  const [milestoneCounts, setMilestoneCounts] = useState<MilestonePolicyCounts | null>(null)
  const [milestoneLoadError, setMilestoneLoadError] = useState<string | null>(null)

  const [calModal, setCalModal] = useState<CalModalState>(null)
  const [toast, setToast] = useState<{ type: 'error' | 'success' | 'info'; message: string } | null>(null)

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    setMilestoneCounts(null)
    setMilestoneLoadError(null)
    setMyAdvisorStatus(null)
    setMyKeyActivation(null)
    setMyConnectionDate(null)
    try {
      const profile = await getMyProfile()
      const targetsOwnerId = profile?.manager_user_id ?? user.id

      setMyAdvisorStatus(profile?.advisor_status ?? null)
      setMyKeyActivation(profile?.key_activation_date ?? null)
      setMyConnectionDate(profile?.connection_date ?? null)

      const stagesList = await pipelineApi.getStages()

      const startToday = startOfTodayMonterreyISO()
      const todayYmd = todayLocalYmd()
      const weekStartHubYmd = getMondayOfWeekYmd(todayYmd)

      const [{ targets }, upcomingRaw, activos, weeklyProd] = await Promise.all([
        fetchWeeklyMinimumTargetsForOwner(supabase, targetsOwnerId),
        calendarApi.listUpcomingEvents({ from: startToday, limit: 40 }),
        pipelineApi.getLeads('activos'),
        getWeeklyProductivity(weekStartHubYmd),
      ])

      const todayEv = upcomingRaw.filter((e) => timestampToYmdInTz(e.starts_at) === todayYmd)
      setTodayEvents(todayEv)

      const leadIdsFromEvents = [...new Set(todayEv.map((e) => e.lead_id).filter(Boolean) as string[])]
      const nameRows =
        leadIdsFromEvents.length > 0 ? await pipelineApi.getLeadsByIds(leadIdsFromEvents) : []
      const names: Record<string, string> = {}
      for (const row of nameRows) names[row.id] = row.full_name
      setEventLeadNames(names)

      const activosIds = activos.map((l) => l.id)
      const nextMap = activosIds.length > 0 ? await batchNextByLeadIds(activosIds) : {}
      const summaries =
        activosIds.length > 0 ? await calendarApi.getSchedulingSummaries(activosIds) : {}

      setStages(stagesList)
      setWeeklyEntryCountsBySlug(weeklyProd.counts)
      setHubWeekStartYmd(weeklyProd.weekStartYmd)
      setTargetsMap(targets)
      setActivosLeads(activos)
      setNextByLeadId(nextMap)
      setSchedulingSummaryByLeadId(summaries)

      if (profile?.advisor_status === 'asesor_12_meses' && profile) {
        const prof: AdvisorMilestoneProfile = {
          user_id: user.id,
          full_name: profile.full_name ?? null,
          display_name: profile.display_name ?? null,
          first_name: profile.first_name ?? null,
          last_name: profile.last_name ?? null,
          birth_date: profile.birth_date ?? null,
          advisor_code: profile.advisor_code ?? null,
          key_activation_date: profile.key_activation_date ?? null,
          connection_date: profile.connection_date ?? null,
          advisor_status: profile.advisor_status ?? null,
        }
        if (!profile.key_activation_date) {
          setMilestoneCounts({ phase1: 0, phase2Cumulative: 0 })
        } else {
          try {
            const map = await fetchMilestonePolicyCounts([prof])
            setMilestoneCounts(map.get(user.id) ?? { phase1: 0, phase2Cumulative: 0 })
          } catch (e) {
            setMilestoneLoadError(e instanceof Error ? e.message : 'No se pudieron cargar los hitos')
            setMilestoneCounts({ phase1: 0, phase2Cumulative: 0 })
          }
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el hub')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (authLoading || !user?.id) return
    void load()
  }, [load, authLoading, user?.id])

  const stageBySlug = useMemo(() => {
    const m = new Map<string, PipelineStage>()
    for (const s of stages) m.set(s.slug, s)
    return m
  }, [stages])

  const leadsSinCitaTop5 = useMemo(() => {
    const sin = activosLeads.filter((l) => !nextByLeadId[l.id])
    sin.sort((a, b) => (a.stage_changed_at < b.stage_changed_at ? 1 : a.stage_changed_at > b.stage_changed_at ? -1 : 0))
    return sin.slice(0, 5)
  }, [activosLeads, nextByLeadId])

  const hubMilestoneStatus = useMemo(() => {
    if (myAdvisorStatus !== 'asesor_12_meses') return null
    const c = milestoneCounts ?? { phase1: 0, phase2Cumulative: 0 }
    return getAdvisorMilestoneStatus({
      advisor_status: myAdvisorStatus,
      key_activation_date: myKeyActivation,
      connection_date: myConnectionDate,
      life_policies_paid_in_phase1: c.phase1,
      life_policies_cumulative_phase2: c.phase2Cumulative,
    })
  }, [myAdvisorStatus, myKeyActivation, myConnectionDate, milestoneCounts])

  const clearCalModal = useCallback(() => setCalModal(null), [])

  const openScheduleForLead = useCallback(
    async (leadId: string) => {
      const r = await resolveCalModalFromGuidance(leadId, {
        leads: activosLeads,
        stages,
        nextAppointmentByLeadId: nextByLeadId,
        schedulingSummaryByLeadId,
      })
      if (r.kind === 'toast') {
        setToast({ type: r.level === 'error' ? 'error' : 'info', message: r.message })
        return
      }
      if (r.kind === 'edit') {
        setCalModal({
          mode: 'edit',
          leadId: r.leadId,
          event: r.event,
          helpText: r.helpText,
        })
        return
      }
      setCalModal({
        mode: 'create',
        leadId: r.leadId,
        initialAppointmentType: r.initialAppointmentType,
        initialTitle: r.initialTitle,
        lockType: r.lockType,
        helpText: r.helpText,
      })
    },
    [activosLeads, stages, nextByLeadId, schedulingSummaryByLeadId]
  )

  if (authLoading || !user) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 text-sm text-neutral-500 dark:text-neutral-400">
        Cargando sesión…
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-0 pb-10">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-6">
            <div className="col-span-12 space-y-2">
              <div className="h-8 w-48 max-w-full rounded-xl bg-neutral-200/90 motion-safe:animate-pulse dark:bg-neutral-800/80" />
              <div className="h-4 w-full max-w-md rounded-lg bg-neutral-200/70 motion-safe:animate-pulse dark:bg-neutral-800/60" />
            </div>
            <div className="h-52 rounded-2xl border border-neutral-200/60 bg-white/80 md:col-span-7 motion-safe:animate-pulse dark:border-neutral-800 dark:bg-neutral-900/40" />
            <div className="h-52 rounded-2xl border border-neutral-200/60 bg-white/80 md:col-span-5 motion-safe:animate-pulse dark:border-neutral-800 dark:bg-neutral-900/40" />
            <div className="col-span-12 h-64 rounded-2xl border border-neutral-200/60 bg-white/80 motion-safe:animate-pulse dark:border-neutral-800 dark:bg-neutral-900/40" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="rounded-2xl border border-red-200/80 bg-white p-6 shadow-sm dark:border-red-900/40 dark:bg-neutral-950/50">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <button
            type="button"
            className="mt-4 inline-flex rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
            onClick={() => void load()}
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-0 pb-10">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="grid grid-cols-1 gap-y-6 gap-x-4 md:grid-cols-12 md:gap-6">
            <AdvisorHubHeader />
            <AdvisorHubTodayCard todayEvents={todayEvents} eventLeadNames={eventLeadNames} />
            <AdvisorHubUrgentLeadsCard
              leads={leadsSinCitaTop5}
              stages={stages}
              onAgendar={(id) => void openScheduleForLead(id)}
            />
            <AdvisorHubPipelinePhasesCard
              stageBySlug={stageBySlug}
              weeklyEntryCountsBySlug={weeklyEntryCountsBySlug}
              hubWeekStartYmd={hubWeekStartYmd}
              targetsMap={targetsMap}
            />
            {myAdvisorStatus === 'asesor_12_meses' && hubMilestoneStatus ? (
              <AdvisorHubMilestones12mCard status={hubMilestoneStatus} loadError={milestoneLoadError} />
            ) : null}
          </div>
        </div>
      </div>

      {calModal != null && calModal.mode === 'create' && (
        <AppointmentFormModal
          key={`create-${calModal.leadId}-${calModal.initialAppointmentType ?? 'd'}`}
          isOpen
          onClose={clearCalModal}
          mode="create"
          onSaved={() => void load()}
          initialLeadId={calModal.leadId}
          createDefaults={{ durationMinutes: 30 }}
          initialAppointmentType={calModal.initialAppointmentType ?? undefined}
          initialTitle={calModal.initialTitle ?? undefined}
          lockType={calModal.lockType ?? null}
          helpText={calModal.helpText ?? null}
        />
      )}

      {calModal != null && calModal.mode === 'edit' && (
        <AppointmentFormModal
          key={`edit-${calModal.event.id}`}
          isOpen
          onClose={clearCalModal}
          mode="edit"
          event={calModal.event}
          onSaved={() => void load()}
          helpText={calModal.helpText ?? null}
        />
      )}

      {toast ? (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} durationMs={2400} />
      ) : null}
    </>
  )
}
