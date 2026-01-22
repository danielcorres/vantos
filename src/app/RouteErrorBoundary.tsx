import { useRouteError } from 'react-router-dom'
import { VantMark } from '../components/branding/VantMark'

export function RouteErrorBoundary() {
  const error = useRouteError()
  console.error('[RouteErrorBoundary]', error)

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 text-center">
      <VantMark size={48} aria-label="VANT" />
      <div>
        <h1 className="text-xl font-semibold text-text mb-2">Algo salió mal</h1>
        <p className="text-muted">Ha ocurrido un error. Por favor, intenta recargar la página.</p>
      </div>
    </div>
  )
}
