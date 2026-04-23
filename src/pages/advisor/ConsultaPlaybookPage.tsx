import { Link } from 'react-router-dom'
import { useAuth } from '../../shared/auth/AuthProvider'
import {
  canEditDocumentation,
  PLAYBOOK_DOCUMENT_SLUG,
  PLAYBOOK_STATIC_SRC,
} from './documentation/documentationConstants'
import { useDocumentationBodyHtml } from './documentation/useDocumentationPage'

export function ConsultaPlaybookPage() {
  const { role } = useAuth()
  const { state, bodyHtml, error } = useDocumentationBodyHtml(PLAYBOOK_DOCUMENT_SLUG)
  const showEdit = canEditDocumentation(role)

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
          {state === 'loading' && (
            <p className="text-xs text-muted mt-1">Comprobando si hay versión actualizada…</p>
          )}
          {error && (
            <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
              No se pudo cargar la versión guardada; se muestra el archivo público.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {showEdit && (
            <Link
              to="/docs/playbook/edit"
              className="text-sm font-medium text-primary hover:underline"
            >
              Editar documento
            </Link>
          )}
          <a
            href={PLAYBOOK_STATIC_SRC}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary hover:underline"
          >
            Abrir en pestaña nueva
          </a>
        </div>
      </div>
      <iframe
        key={bodyHtml ? 'srcdoc' : 'static'}
        title="Playbook Consulta"
        {...(bodyHtml
          ? { srcDoc: bodyHtml }
          : {
              src: PLAYBOOK_STATIC_SRC,
            })}
        className="flex-1 min-h-0 w-full rounded-lg border border-border bg-white shadow-sm"
      />
    </div>
  )
}
