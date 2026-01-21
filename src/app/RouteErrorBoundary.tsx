import { useRouteError } from 'react-router-dom'

export function RouteErrorBoundary() {
  const error = useRouteError()
  console.error('[RouteErrorBoundary]', error)

  return (
    <div style={{ textAlign: 'center', padding: '40px' }}>
      <h1>Algo salió mal</h1>
      <p>Ha ocurrido un error. Por favor, intenta recargar la página.</p>
    </div>
  )
}
