import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  PLAYBOOK_DEFAULT_TITLE,
  PLAYBOOK_DOCUMENT_SLUG,
} from './documentation/documentationConstants'
import { useDocumentationEditor } from './documentation/useDocumentationPage'

export function DocumentationEditPage() {
  const navigate = useNavigate()
  const {
    state,
    html,
    setHtml,
    title,
    setTitle,
    loadSource,
    error,
    saving,
    saveError,
    setSaveError,
    save,
  } = useDocumentationEditor(PLAYBOOK_DOCUMENT_SLUG, PLAYBOOK_DEFAULT_TITLE)
  const [showPreview, setShowPreview] = useState(false)

  const handleSave = async () => {
    try {
      await save()
      navigate('/docs/playbook')
    } catch {
      /* saveError ya asignado */
    }
  }

  if (state === 'loading' || state === 'idle') {
    return (
      <div className="max-w-[1400px] mx-auto w-full px-4 py-8">
        <p className="text-sm text-muted">Cargando documento…</p>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="max-w-[1400px] mx-auto w-full px-4 py-8 space-y-4">
        <p className="text-sm text-red-600">{error}</p>
        <Link to="/docs/playbook" className="text-sm font-medium text-primary hover:underline">
          Volver al playbook
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 max-w-[1400px] mx-auto w-full px-4 pb-8 min-h-[calc(100vh-8rem)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link to="/docs/playbook" className="text-sm font-medium text-muted hover:text-primary hover:underline">
            Volver al playbook
          </Link>
          <h1 className="text-2xl font-semibold text-text mt-2">Editar documentación</h1>
          <p className="text-sm text-muted mt-1">
            {loadSource === 'database'
              ? 'Estás editando la versión guardada en el sistema.'
              : 'Aún no hay versión en base de datos: se cargó la plantilla del archivo público. Al guardar se creará la copia editable.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={() => {
              setSaveError(null)
              setShowPreview((v) => !v)
            }}
          >
            {showPreview ? 'Ocultar vista previa' : 'Vista previa'}
          </button>
          <button
            type="button"
            className="btn btn-primary text-sm"
            disabled={saving}
            onClick={() => {
              void handleSave()
            }}
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-3 min-h-0">
          <label className="text-sm font-medium text-text">
            Título
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm font-medium text-text flex-1 flex flex-col min-h-0">
            HTML
            <textarea
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              spellCheck={false}
              className="mt-1 w-full flex-1 min-h-[320px] lg:min-h-[70vh] rounded-md border border-border bg-bg px-3 py-2 text-xs font-mono leading-relaxed"
            />
          </label>
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        </div>
        {showPreview && (
          <div className="flex flex-col gap-2 min-h-0">
            <span className="text-sm font-medium text-muted">Vista previa (contenido saneado al guardar)</span>
            <iframe
              title="Vista previa"
              srcDoc={html}
              sandbox="allow-same-origin allow-popups"
              className="min-h-[320px] lg:min-h-[70vh] w-full flex-1 rounded-lg border border-border bg-white"
            />
          </div>
        )}
      </div>
    </div>
  )
}
