import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
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
import {
  advisorFormalNameForBirthday,
  completedAgeOnBirthday,
  deriveWelcomeName,
  isBirthdayToday,
  timeOfDayGreetingMonterrey,
} from '../shared/utils/advisorGreeting'
import { getWeeklyProductivity } from '../features/productivity/api/productivity.api'
import type { StageSlug } from '../features/productivity/types/productivity.types'
import type { LeadSchedulingSummary } from '../features/calendar/utils/stageSchedulingGuidance'
import { resolveCalModalFromGuidance } from '../features/pipeline/utils/resolveCalModalFromGuidance'
import { AppointmentFormModal } from '../features/calendar/components/AppointmentFormModal'
import type { AppointmentType } from '../features/calendar/types/calendar.types'
import {
  fetchMilestonePolicyCounts,
  type AdvisorMilestoneProfile,
  type MilestonePolicyCounts,
} from '../modules/advisors/data/advisorMilestones.api'
import { getAdvisorMilestoneStatus } from '../modules/advisors/domain/advisorMilestones'
import {
  AdvisorHubHeader,
  type AdvisorHubBirthdayBanner,
} from '../features/advisor-hub/components/AdvisorHubHeader'
import { AdvisorHubTodayCard } from '../features/advisor-hub/components/AdvisorHubTodayCard'
import { AdvisorHubUrgentLeadsCard } from '../features/advisor-hub/components/AdvisorHubUrgentLeadsCard'
import { AdvisorHubPipelinePhasesCard } from '../features/advisor-hub/components/AdvisorHubPipelinePhasesCard'
import { AdvisorHubMilestones12mCard } from '../features/advisor-hub/components/AdvisorHubMilestones12mCard'
import { useNotify } from '../shared/utils/notify'
import { AnimatedContainer } from '../components/ui/AnimatedContainer'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'

/** Máximo de filas en Citas de hoy y en Leads sin cita en el hub (evita tarjetas muy altas). */
const HUB_LIST_VISIBLE_CAP = 5

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
  const notify = useNotify()
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [stages, setStages] = useState<PipelineStage[]>([])
  const [inventoryCountsByStageId, setInventoryCountsByStageId] = useState<Record<string, number>>({})
  const [weeklyEntryCountsBySlug, setWeeklyEntryCountsBySlug] = useState<Record<StageSlug, number>>(
    () => ({}) as Record<StageSlug, number>
  )
  const [hubWeekStartYmd, setHubWeekStartYmd] = useState('')
  const [targetsMap, setTargetsMap] = useState<
    Awaited<ReturnType<typeof fetchWeeklyMinimumTargetsForOwner>>['targets']
  >({} as never)

  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([])
  const [eventLeadNames, setEventLeadNames] = useState<Record<string, string>>({})
  const [eventLeadStageNames, setEventLeadStageNames] = useState<Record<string, string>>({})

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

  const [hubGreetingLine, setHubGreetingLine] = useState('')
  const [hubBirthdayBanner, setHubBirthdayBanner] = useState<AdvisorHubBirthdayBanner | null>(null)
  const hubBirthdayConfettiFired = useRef(false)

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
      const todayYmdForGreeting = todayLocalYmd()
      const welcomeFirst = deriveWelcomeName(profile, user?.email ?? null)
      const saludo = `${timeOfDayGreetingMonterrey()}, ${welcomeFirst}`
      setHubGreetingLine(saludo)
      const cumple = isBirthdayToday(profile?.birth_date, todayYmdForGreeting)
      if (cumple && profile?.birth_date) {
        const age = completedAgeOnBirthday(profile.birth_date, todayYmdForGreeting)
        setHubBirthdayBanner({
          displayName: advisorFormalNameForBirthday(profile, welcomeFirst),
          age,
        })
      } else {
        setHubBirthdayBanner(null)
      }

      const targetsOwnerId = profile?.manager_user_id ?? user.id

      setMyAdvisorStatus(profile?.advisor_status ?? null)
      setMyKeyActivation(profile?.key_activation_date ?? null)
      setMyConnectionDate(profile?.connection_date ?? null)

      const stagesList = await pipelineApi.getStages()
      const stageIds = stagesList.map((s) => s.id)

      const startToday = startOfTodayMonterreyISO()
      const todayYmd = todayYmdForGreeting
      const weekStartHubYmd = getMondayOfWeekYmd(todayYmd)

      const [inventoryCounts, { targets }, upcomingRaw, activos, weeklyProd] = await Promise.all([
        pipelineApi.getActiveLeadCountsByStages(stageIds),
        fetchWeeklyMinimumTargetsForOwner(supabase, targetsOwnerId),
        calendarApi.listUpcomingEvents({ from: startToday, limit: 40 }),
        pipelineApi.getLeads('activos'),
        getWeeklyProductivity(weekStartHubYmd),
      ])

      const todayEv = upcomingRaw.filter((e) => timestampToYmdInTz(e.starts_at) === todayYmd)
      const activosIdSet = new Set(activos.map((l) => l.id))
      const todayEvFiltered = todayEv.filter((e) => !e.lead_id || activosIdSet.has(e.lead_id))
      setTodayEvents(todayEvFiltered)

      const leadIdsFromEvents = [
        ...new Set(todayEvFiltered.map((e) => e.lead_id).filter(Boolean) as string[]),
      ]
      const nameRows =
        leadIdsFromEvents.length > 0 ? await pipelineApi.getLeadsByIds(leadIdsFromEvents) : []
      const names: Record<string, string> = {}
      const stageById = new Map(stagesList.map((s) => [s.id, s.name]))
      const stageNames: Record<string, string> = {}
      for (const row of nameRows) {
        names[row.id] = row.full_name
        const label = stageById.get(row.stage_id)
        if (label) stageNames[row.id] = label
      }
      setEventLeadNames(names)
      setEventLeadStageNames(stageNames)

      const activosIds = activos.map((l) => l.id)
      const nextMap = activosIds.length > 0 ? await batchNextByLeadIds(activosIds) : {}
      const summaries =
        activosIds.length > 0 ? await calendarApi.getSchedulingSummaries(activosIds) : {}

      setStages(stagesList)
      setInventoryCountsByStageId(inventoryCounts)
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
  }, [user?.id, user?.email])

  useEffect(() => {
    if (authLoading || !user?.id) return
    void load()
  }, [load, authLoading, user?.id])

  useEffect(() => {
    hubBirthdayConfettiFired.current = false
  }, [user?.id])

  useEffect(() => {
    if (!hubBirthdayBanner || hubBirthdayConfettiFired.current) return
    hubBirthdayConfettiFired.current = true
    const prefersReduced =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) return
    void confetti({
      particleCount: 130,
      spread: 72,
      origin: { y: 0.65 },
      ticks: 200,
    })
  }, [hubBirthdayBanner])

  const stageBySlug = useMemo(() => {
    const m = new Map<string, PipelineStage>()
    for (const s of stages) m.set(s.slug, s)
    return m
  }, [stages])

  const todayEventsSorted = useMemo(() => {
    return [...todayEvents].sort(
      (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
    )
  }, [todayEvents])

  const todayEventsVisible = useMemo(
    () => todayEventsSorted.slice(0, HUB_LIST_VISIBLE_CAP),
    [todayEventsSorted]
  )

  const leadsSinCitaSorted = useMemo(() => {
    const contactosStage = stageBySlug.get('contactos_nuevos')
    const sin = activosLeads.filter(
      (l) =>
        !nextByLeadId[l.id] && (!contactosStage || l.stage_id === contactosStage.id)
    )
    sin.sort((a, b) => (a.stage_changed_at < b.stage_changed_at ? 1 : a.stage_changed_at > b.stage_changed_at ? -1 : 0))
    return sin
  }, [activosLeads, nextByLeadId, stageBySlug])

  const leadsSinCitaTop5 = useMemo(
    () => leadsSinCitaSorted.slice(0, HUB_LIST_VISIBLE_CAP),
    [leadsSinCitaSorted]
  )

  const urgentesSinCitaTotal = leadsSinCitaSorted.length

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
        notify.raw(r.message, r.level === 'error' ? 'error' : 'info')
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
      <div className="mx-auto max-w-6xl px-4 py-12">
        <AnimatedContainer
          variant="up"
          className="rounded-2xl border border-neutral-200/70 bg-white/90 p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900/60"
        >
          <LoadingSpinner label="Cargando sesión..." className="text-neutral-600 dark:text-neutral-300" />
        </AnimatedContainer>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-0 pb-10">
        <AnimatedContainer variant="up" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <div className="mb-4">
            <LoadingSpinner label="Cargando inicio..." className="text-neutral-600 dark:text-neutral-300" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-6">
            <div className="col-span-12 space-y-2">
              <div className="h-8 w-48 max-w-full rounded-xl bg-neutral-200/90 motion-safe:animate-pulse dark:bg-neutral-800/80" />
              <div className="h-4 w-full max-w-md rounded-lg bg-neutral-200/70 motion-safe:animate-pulse dark:bg-neutral-800/60" />
            </div>
            <div className="h-52 rounded-2xl border border-neutral-200/60 bg-white/80 md:col-span-7 motion-safe:animate-pulse dark:border-neutral-800 dark:bg-neutral-900/40" />
            <div className="h-52 rounded-2xl border border-neutral-200/60 bg-white/80 md:col-span-5 motion-safe:animate-pulse dark:border-neutral-800 dark:bg-neutral-900/40" />
            <div className="col-span-12 h-64 rounded-2xl border border-neutral-200/60 bg-white/80 motion-safe:animate-pulse dark:border-neutral-800 dark:bg-neutral-900/40" />
          </div>
        </AnimatedContainer>
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
            <AdvisorHubHeader greetingLine={hubGreetingLine} birthdayBanner={hubBirthdayBanner} />
            <AdvisorHubTodayCard
              visibleEvents={todayEventsVisible}
              totalTodayCount={todayEventsSorted.length}
              eventLeadNames={eventLeadNames}
              eventLeadStageNames={eventLeadStageNames}
            />
            <AdvisorHubUrgentLeadsCard
              leads={leadsSinCitaTop5}
              totalSinCita={urgentesSinCitaTotal}
              stages={stages}
              onAgendar={(id) => void openScheduleForLead(id)}
            />
            <AdvisorHubPipelinePhasesCard
              stageBySlug={stageBySlug}
              inventoryCountsByStageId={inventoryCountsByStageId}
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

    </>
  )
}
