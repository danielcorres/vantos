import { Link } from 'react-router-dom'

export function AdvisorHubHeader() {
  return (
    <header className="col-span-12 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-[1.65rem]">
          Hub semanal
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Resumen de citas, embudo y seguimiento. Todo en un vistazo.
        </p>
      </div>
      <Link
        to="/okr/daily?date=today"
        className="inline-flex w-full shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 sm:w-auto dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
      >
        Registrar actividad
      </Link>
    </header>
  )
}
