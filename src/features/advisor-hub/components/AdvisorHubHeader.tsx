import { Link } from 'react-router-dom'

export type AdvisorHubBirthdayBanner = {
  displayName: string
  age: number
}

type Props = {
  /** Ej. "Buenos días, Ana" (hora en America/Monterrey + nombre corto). */
  greetingLine?: string | null
  /** Si hay cumpleaños hoy, texto largo con nombre formal y edad. */
  birthdayBanner?: AdvisorHubBirthdayBanner | null
}

export function AdvisorHubHeader({ greetingLine = null, birthdayBanner = null }: Props) {
  return (
    <header className="col-span-12 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {greetingLine ? (
          <p className="text-xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-2xl">
            {greetingLine}
          </p>
        ) : null}
        {birthdayBanner ? (
          <div
            className="mt-3 max-w-2xl rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-rose-50 to-violet-50 px-4 py-3 shadow-sm dark:border-amber-800/50 dark:from-amber-950/40 dark:via-rose-950/30 dark:to-violet-950/30"
            role="status"
            aria-live="polite"
          >
            <p className="text-center text-base font-semibold leading-relaxed text-neutral-900 dark:text-neutral-100 sm:text-lg">
              {birthdayBanner.age > 0 ? (
                <>
                  ¡Feliz cumpleaños, {birthdayBanner.displayName}! Disfruta tus {birthdayBanner.age} años. Lo mejor para
                  ti.
                </>
              ) : (
                <>¡Feliz cumpleaños, {birthdayBanner.displayName}! Lo mejor para ti.</>
              )}
            </p>
          </div>
        ) : null}
        <h1
          className={`text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-[1.65rem] ${greetingLine || birthdayBanner ? 'mt-4' : ''}`}
        >
          Hub semanal
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          Resumen de citas, embudo y seguimiento. Todo en un vistazo.
        </p>
      </div>
      <Link
        to="/okr/daily?date=today"
        className="inline-flex w-full shrink-0 items-center justify-center self-start rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 sm:w-auto dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
      >
        Registrar actividad
      </Link>
    </header>
  )
}
