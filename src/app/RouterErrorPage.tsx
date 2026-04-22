import { VantMark } from '../components/branding/VantMark'

/** Pantalla genérica para `errorElement` del router (fuera del shell). */
export function RouterErrorPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 text-center">
      <VantMark size={40} aria-label="VANT" />
      <div>
        <h1 className="text-xl font-semibold text-text mb-2">Error</h1>
        <p className="text-muted">Algo salió mal. Por favor, intenta recargar la página.</p>
      </div>
    </div>
  )
}
