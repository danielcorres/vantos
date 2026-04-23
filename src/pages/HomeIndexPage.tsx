import { useAuth } from '../shared/auth/AuthProvider'
import { OkrHomePage } from '../modules/okr/pages/OkrHomePage'
import { AdvisorHomePage } from './AdvisorHomePage'

/**
 * Ruta índice `/`: asesores ven el Hub Semanal; el resto mantiene OKR home.
 */
export function HomeIndexPage() {
  const { role } = useAuth()
  if (role === 'advisor') {
    return <AdvisorHomePage />
  }
  return <OkrHomePage />
}
