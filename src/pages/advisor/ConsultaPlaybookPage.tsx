import { Link } from 'react-router-dom'

const PLAYBOOK_SRC = '/docs/playbook-consulta.html'

export function ConsultaPlaybookPage() {
  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)] min-h-[480px] max-w-[1400px] mx-auto w-full px-4 pb-6">
      <div className="flex flex-wrap items-end justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <Link
            to="/docs"
            className="text-sm font-medium text-muted hover:text-primary hover:underline"
          >
            Volver a Documentación
          </Link>
          <h1 className="text-2xl font-semibold text-text mt-2">Playbook Consulta</h1>
          <p className="text-sm text-muted mt-1">
            Manual de onboarding y operación del Sistema Consulta (documentación interna).
          </p>
        </div>
        <a
          href={PLAYBOOK_SRC}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-primary hover:underline shrink-0"
        >
          Abrir en pestaña nueva
        </a>
      </div>
      <iframe
        title="Playbook Consulta"
        src={PLAYBOOK_SRC}
        className="flex-1 min-h-0 w-full rounded-lg border border-border bg-white shadow-sm"
      />
    </div>
  )
}
