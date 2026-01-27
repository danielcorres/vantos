/**
 * Barra fija inferior que solo se muestra cuando hay cambios sin guardar.
 * Compatible con safe-area (mobile), ancho completo, borde superior y fondo sólido.
 */
export type UnsavedChangesBarProps = {
  open: boolean
  onSave: () => void
  onDiscard: () => void
  isSaving?: boolean
}

const BAR_HEIGHT = 64

export function UnsavedChangesBar({
  open,
  onSave,
  onDiscard,
  isSaving = false,
}: UnsavedChangesBarProps) {
  if (!open) return null

  const handleDiscard = () => {
    if (window.confirm('¿Descartar cambios?')) {
      onDiscard()
    }
  }

  return (
    <footer
      role="region"
      aria-live="polite"
      aria-label="Cambios sin guardar"
      className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.06)]"
      style={{
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        minHeight: BAR_HEIGHT,
      }}
    >
      <span className="text-sm text-muted whitespace-nowrap">
        Tienes cambios sin guardar
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="btn btn-primary text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          aria-busy={isSaving}
        >
          {isSaving ? 'Guardando…' : 'Guardar cambios'}
        </button>
        <button
          type="button"
          onClick={handleDiscard}
          disabled={isSaving}
          className="btn btn-ghost border border-border text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Descartar
        </button>
      </div>
    </footer>
  )
}

/** Altura aproximada de la barra para padding-bottom del contenedor (px). */
export const UNSAVED_BAR_HEIGHT = BAR_HEIGHT + 8
