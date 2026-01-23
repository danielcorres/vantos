import { NavLink, useLocation } from 'react-router-dom'
import {
  IconHome,
  IconCalendar,
  IconTarget,
  IconLogout,
} from './icons'
import { useAuth } from '../../shared/auth/AuthProvider'
import { VantLogo } from '../../components/branding/VantLogo'

type SidebarProps = {
  userEmail?: string
  onSignOut: () => void
  onNavigate?: () => void // Para cerrar drawer en mobile
}

export function Sidebar({ userEmail, onSignOut, onNavigate }: SidebarProps) {
  const location = useLocation()
  const { role, loading: authLoading } = useAuth()
  const canSeeConfig = role === 'owner'
  const canSeeAssignments = role === 'owner' || role === 'director'
  const canSeeOwnerDashboard = role === 'owner' || role === 'director' || role === 'seguimiento'

  const handleNavClick = () => {
    // Cerrar drawer en mobile al navegar
    if (onNavigate) {
      onNavigate()
    }
  }

  // Helper para verificar si una ruta está activa
  const checkIsActive = (path: string, currentPath: string) => {
    if (path.includes('?')) {
      return currentPath === path.split('?')[0]
    }
    return currentPath === path || currentPath.startsWith(path + '/')
  }

  return (
    <div className="flex flex-col h-full bg-surface border-r border-border">
      {/* Logo/Header */}
      <div className="px-4 pt-4 pb-3 border-b border-border flex flex-col items-center">
        <VantLogo size={38} mode="light" className="shrink-0 mx-auto" aria-label="vant" />
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 text-center">V 1.0</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Sección OKR */}
        <div>
          <div className="px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wide mb-1">
            OKR
          </div>
          <div className="space-y-1">
            <NavLink
              to="/okr/daily?date=today"
              end={false}
              className={({ isActive }) => {
                const active = isActive || checkIsActive('/okr/daily', location.pathname)
                return `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-primary/10 text-primary border-l-4 border-primary'
                    : 'text-text hover:bg-black/5'
                }`
              }}
              onClick={handleNavClick}
            >
              <IconHome />
              <span>Diario</span>
            </NavLink>

            <NavLink
              to="/week"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary border-l-4 border-primary'
                    : 'text-text hover:bg-black/5'
                }`
              }
              onClick={handleNavClick}
            >
              <IconCalendar />
              <span>Semana</span>
            </NavLink>

          </div>
        </div>

        {/* Sección Dashboard (para owner, director, seguimiento) */}
        {!authLoading && canSeeOwnerDashboard && (
          <div>
            <div className="px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wide mb-1">
              Dashboard
            </div>
            <div className="space-y-1">
              <NavLink
                to="/owner/dashboard"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary border-l-4 border-primary'
                      : 'text-text hover:bg-black/5'
                  }`
                }
                onClick={handleNavClick}
              >
                <span>Dashboard</span>
              </NavLink>
            </div>
          </div>
        )}

        {/* Sección Configuración (solo para owner) */}
        {!authLoading && canSeeConfig && (
          <div>
            <div className="px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wide mb-1">
              Configuración
            </div>
            <div className="space-y-1">
              <NavLink
                to="/okr/scoring"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary border-l-4 border-primary'
                      : 'text-text hover:bg-black/5'
                  }`
                }
                onClick={handleNavClick}
              >
                <IconTarget />
                <span>Puntajes OKR</span>
              </NavLink>
              {!authLoading && canSeeAssignments && (
                <NavLink
                  to="/owner/assignments"
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary border-l-4 border-primary'
                        : 'text-text hover:bg-black/5'
                    }`
                  }
                  onClick={handleNavClick}
                >
                  <span>Asignaciones</span>
                </NavLink>
              )}
              <NavLink
                to="/settings/okr-minimums"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary border-l-4 border-primary'
                      : 'text-text hover:bg-black/5'
                  }`
                }
                onClick={handleNavClick}
              >
                <span>Mínimos semanales</span>
              </NavLink>
            </div>
          </div>
        )}

        {/* Sección Manager (solo para manager) */}
        {!authLoading && (role === 'manager' || role === 'owner') && (
          <div>
            <div className="px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wide mb-1">
              Manager
            </div>
            <div className="space-y-1">
              <NavLink
                to="/manager/dashboard"
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary border-l-4 border-primary'
                      : 'text-text hover:bg-black/5'
                  }`
                }
                onClick={handleNavClick}
              >
                <span>Dashboard Manager</span>
              </NavLink>
            </div>
          </div>
        )}
        
        {/* Sección Cuenta */}
        <div>
          <div className="px-4 py-2 text-xs font-semibold text-muted uppercase tracking-wide mb-1">
            Cuenta
          </div>
          <div className="space-y-1">
            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary border-l-4 border-primary'
                    : 'text-text hover:bg-black/5'
                }`
              }
              onClick={handleNavClick}
            >
              <span>Mi perfil</span>
            </NavLink>
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border space-y-2">
        {userEmail && (
          <div className="text-xs text-muted px-2 truncate">{userEmail}</div>
        )}
        <button
          onClick={() => {
            handleNavClick()
            onSignOut()
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-text hover:bg-black/5 transition-colors"
        >
          <IconLogout />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </div>
  )
}
