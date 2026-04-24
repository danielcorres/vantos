import { Link } from 'react-router-dom'
import type { CalendarEvent } from '../../calendar/types/calendar.types'
import { HUB_CARD, HUB_SECTION_TITLE } from '../hubStyles'

function formatTimeMx(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return '—'
  }
}

type Props = {
  todayEvents: CalendarEvent[]
  eventLeadNames: Record<string, string>
}

export function AdvisorHubTodayCard({ todayEvents, eventLeadNames }: Props) {
  return (
    <section className={`${HUB_CARD} md:col-span-7 flex flex-col min-h-[11rem]`}>
      <h2 className={`${HUB_SECTION_TITLE} mb-4`}>Citas de hoy</h2>
      {todayEvents.length === 0 ? (
        <div className="flex flex-1 flex-col justify-center gap-3 text-sm text-neutral-600 dark:text-neutral-400">
          <p>Sin citas hoy.</p>
          <Link
            to="/calendar"
            className="inline-flex w-fit items-center rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
          >
            Ver calendario
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {todayEvents.map((ev) => {
            const name = ev.lead_id ? eventLeadNames[ev.lead_id] ?? 'Lead' : 'Sin lead'
            const title = ev.title?.trim() || 'Cita'
            return (
              <li
                key={ev.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50/60 px-3 py-2.5 dark:border-neutral-800/80 dark:bg-neutral-900/40"
              >
                <div className="min-w-0 text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
                  <span className="tabular-nums font-medium text-neutral-500 dark:text-neutral-400">
                    {formatTimeMx(ev.starts_at)}
                  </span>
                  <span className="text-neutral-400 dark:text-neutral-500"> · </span>
                  <span className="font-medium">{title}</span>
                  <span className="text-neutral-400 dark:text-neutral-500"> · </span>
                  <span>{name}</span>
                </div>
                {ev.lead_id ? (
                  <Link
                    to={`/leads/${ev.lead_id}`}
                    className="shrink-0 text-sm font-medium text-neutral-900 underline-offset-2 hover:underline dark:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 rounded-sm"
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
  )
}
