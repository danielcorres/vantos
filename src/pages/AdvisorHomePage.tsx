import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../shared/auth/AuthProvider'
import { getMyProfile } from '../lib/profile'
import { supabase } from '../lib/supabase'
import { pipelineApi, type Lead, type PipelineStage } from '../features/pipeline/pipeline.api'
import { calendarApi } from '../features/calendar/api/calendar.api'
import type { CalendarEvent } from '../features/calendar/types/calendar.types'
import { fetchWeeklyMinimumTargetsForOwner } from '../modules/okr/dashboard/weeklyMinimumTargets'
import {
  startOfTodayMonterreyISO,
  timestampToYmdInTz,
  todayLocalYmd,
  diffDaysFloor,
} from '../shared/utils/dates'
import { displayStageName } from '../shared/utils/stageStyles'
import { STAGE_SLUGS_ORDER } from '../features/productivity/types/productivity.types'
import type { StageSlug } from '../features/productivity/types/productivity.types'
import {
  formatPipelineWeeklyTargetDisplay,
  pipelineTargetIsWeeklyPremiumMxn,
  weeklyTargetForPipelineSlug,
} from '../features/pipeline/utils/weeklyStageTargets'
import type { LeadSchedulingSummary } from '../features/calendar/utils/stageSchedulingGuidance'
import { resolveCalModalFromGuidance } from '../features/pipeline/utils/resolveCalModalFromGuidance'
import { AppointmentFormModal } from '../features/calendar/components/AppointmentFormModal'
import type { AppointmentType } from '../features/calendar/types/calendar.types'
import { Toast } from '../shared/components/Toast'

/** Todas las etapas del embudo, incluida Pólizas Pagadas (`casos_ganados`). */
const EMBUDO_SLUGS: StageSlug[] = [...STAGE_SLUGS_ORDER]

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

function formatTimeMx(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
  } catch {
    return '—'
  }
}

export function AdvisorHomePage() {
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [stages, setStages] = useState<PipelineStage[]>([])
  const [countsByStageId, setCountsByStageId] = useState<Record<string, number>>({})
  const [targetsMap, setTargetsMap] = useState<Awaited<ReturnType<typeof fetchWeeklyMinimumTargetsForOwner>>['targets']>(
    {} as never
  )

  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([])
  const [eventLeadNames, setEventLeadNames] = useState<Record<string, string>>({})

  const [activosLeads, setActivosLeads] = useState<Lead[]>([])
  const [nextByLeadId, setNextByLeadId] = useState<Record<string, CalendarEvent | null>>({})
  const [schedulingSummaryByLeadId, setSchedulingSummaryByLeadId] = useState<Record<string, LeadSchedulingSummary>>({})

  const [calModal, setCalModal] = useState<CalModalState>(null)
  const [toast, setToast] = useState<{ type: 'error' | 'success' | 'info'; message: string } | null>(null)

  const load = useCallback(async () => {
    if (!user?.id) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const profile = await getMyProfile()
      const targetsOwnerId = profile?.manager_user_id ?? user.id

      const stagesList = await pipelineApi.getStages()
      const stageIds = stagesList.map((s) => s.id)

      const startToday = startOfTodayMonterreyISO()
      const todayYmd = todayLocalYmd()

      const [counts, { targets }, upcomingRaw, activos] = await Promise.all([
        pipelineApi.getActiveLeadCountsByStages(stageIds),
        fetchWeeklyMinimumTargetsForOwner(supabase, targetsOwnerId),
        calendarApi.listUpcomingEvents({ from: startToday, limit: 40 }),
        pipelineApi.getLeads('activos'),
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
      setCountsByStageId(counts)
      setTargetsMap(targets)
      setActivosLeads(activos)
      setNextByLeadId(nextMap)
      setSchedulingSummaryByLeadId(summaries)
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
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-neutral-500">Cargando sesión…</div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-neutral-500">Cargando tu semana…</div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-red-600">{error}</p>
        <button type="button" className="mt-2 text-sm text-primary underline" onClick={() => void load()}>
          Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-8">
      <header>
        <h1 className="text-xl font-semibold text-neutral-900">Hub semanal</h1>
        <p className="text-sm text-neutral-500 mt-1">Resumen de citas, embudo y seguimiento.</p>
      </header>

      {/* Bloque A */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-800 mb-3">Citas de hoy</h2>
        {todayEvents.length === 0 ? (
          <div className="text-sm text-neutral-600 space-y-2">
            <p>Sin citas hoy.</p>
            <Link
              to="/calendar"
              className="inline-flex items-center rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
            >
              Ver calendario
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {todayEvents.map((ev) => {
              const name = ev.lead_id ? eventLeadNames[ev.lead_id] ?? 'Lead' : 'Sin lead'
              const title = ev.title?.trim() || 'Cita'
              return (
                <li key={ev.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-neutral-700">
                    <span className="tabular-nums text-neutral-500">{formatTimeMx(ev.starts_at)}</span>
                    {' · '}
                    <span className="font-medium">{title}</span>
                    {' · '}
                    {name}
                  </span>
                  {ev.lead_id ? (
                    <Link
                      to={`/leads/${ev.lead_id}`}
                      className="shrink-0 text-primary text-sm font-medium hover:underline"
                    >
                      Ir al lead
                    </Link>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* Bloque B */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-800 mb-3">Embudo vs. meta semanal</h2>
        <ul className="space-y-2">
          {EMBUDO_SLUGS.map((slug) => {
            const st = stageBySlug.get(slug)
            if (!st) return null
            const count = countsByStageId[st.id] ?? 0
            const target = weeklyTargetForPipelineSlug(slug, targetsMap)
            const bajo =
              target != null &&
              !pipelineTargetIsWeeklyPremiumMxn(slug) &&
              count < target
            return (
              <li key={slug}>
                <Link
                  to="/pipeline"
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-2 -mx-2 hover:bg-neutral-50 text-sm"
                >
                  <span className="font-medium text-neutral-800">{displayStageName(st.name)}</span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={bajo ? 'tabular-nums text-orange-600 font-semibold' : 'tabular-nums text-neutral-700'}>
                      {count}
                      {target != null ? (
                        <>
                          {' / '}
                          {formatPipelineWeeklyTargetDisplay(slug, target)}
                          {!pipelineTargetIsWeeklyPremiumMxn(slug) && !bajo ? ' ✓' : null}
                        </>
                      ) : null}
                    </span>
                    {bajo ? <span className="text-xs text-orange-600">Bajo meta</span> : null}
                    <span className="text-xs text-primary">Pipeline →</span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Bloque C */}
      <section className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-800 mb-3">Leads sin cita (urgentes)</h2>
        {leadsSinCitaTop5.length === 0 ? (
          <p className="text-sm text-neutral-500">Todos los leads activos tienen al menos una cita programada.</p>
        ) : (
          <ul className="space-y-3">
            {leadsSinCitaTop5.map((lead) => {
              const stName = stages.find((s) => s.id === lead.stage_id)?.name ?? '—'
              const dias = diffDaysFloor(lead.stage_changed_at, new Date())
              return (
                <li
                  key={lead.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3 last:border-0 last:pb-0"
                >
                  <div className="text-sm text-neutral-700 min-w-0">
                    <span className="font-medium">{lead.full_name}</span>
                    <span className="text-neutral-400"> · </span>
                    <span>{displayStageName(stName)}</span>
                    <span className="text-neutral-400"> · </span>
                    <span className="text-orange-700">{dias} días sin cita</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void openScheduleForLead(lead.id)}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                    >
                      Agendar
                    </button>
                    <Link to={`/leads/${lead.id}`} className="text-xs text-primary font-medium hover:underline">
                      Ver lead
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

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
    </div>
  )
}
