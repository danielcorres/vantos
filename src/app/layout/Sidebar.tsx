import { NavLink, useLocation } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import {
  IconHome,
  IconCalendarDays,
  IconCalendarRange,
  IconLayoutDashboard,
  IconBarChart3,
  IconTarget,
  IconUserCog,
  IconSlidersHorizontal,
  IconUser,
  IconLogout,
  IconChevronLeft,
  IconChevronRight,
} from './icons'
import { useAuth } from '../../shared/auth/AuthProvider'
import { VantLogo } from '../../components/branding/VantLogo'
import { VantMark } from '../../components/branding/VantMark'
import { getHomePathForRole } from '../../modules/auth/getHomePathForRole'

type SidebarProps = {
  userEmail?: string
  onSignOut: () => void
  onNavigate?: () => void // Para cerrar drawer en mobile
  isMobile?: boolean
  isOpen?: boolean
  onClose?: () => void
  onCollapsedChange?: (collapsed: boolean) => void
}

type MenuItem = {
  label: string
  path: string
  icon: React.ComponentType<{ className?: string; size?: number }>
  visible: (role: string | null, loading: boolean) => boolean
  exact?: boolean
}

type MenuSection = {
  title: string
  items: MenuItem[]
  visible: (role: string | null, loading: boolean) => boolean
}

export function Sidebar({ userEmail, onSignOut, onNavigate, isMobile = false, isOpen = false, onClose, onCollapsedChange }: SidebarProps) {
  const location = useLocation()
  const { role, loading: authLoading } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [tooltipItem, setTooltipItem] = useState<string | null>(null)
  const tooltipTimeoutRef = useRef<number | null>(null)

  // Notificar cambios en collapsed al padre
  useEffect(() => {
    if (onCollapsedChange) {
      onCollapsedChange(collapsed)
    }
  }, [collapsed, onCollapsedChange])

  // Obtener home path dinámicamente
  const homePath = getHomePathForRole(role)

  // Definir estructura del menú
  const menuSections: MenuSection[] = [
    {
      title: 'Principal',
      visible: () => true,
      items: [
        {
          label: 'Inicio',
          path: homePath,
          icon: IconHome,
          visible: () => true,
        },
        {
          label: 'OKR Diario',
          path: '/okr/daily?date=today',
          icon: IconCalendarDays,
          visible: () => true,
          exact: false,
        },
        {
          label: 'OKR Semana',
          path: '/week',
          icon: IconCalendarRange,
          visible: () => true,
        },
      ],
    },
    {
      title: 'Dashboards',
      visible: (r, loading) => {
        if (loading) return false
        return r === 'owner' || r === 'director' || r === 'seguimiento' || r === 'manager'
      },
      items: [
        {
          label: 'Dashboard',
          path: '/owner/dashboard',
          icon: IconLayoutDashboard,
          visible: (r) => r === 'owner' || r === 'director' || r === 'seguimiento',
        },
        {
          label: 'Dashboard Manager',
          path: '/manager/dashboard',
          icon: IconBarChart3,
          visible: (r) => r === 'manager' || r === 'owner' || r === 'director' || r === 'seguimiento',
        },
      ],
    },
    {
      title: 'Configuración',
      visible: (r) => r === 'owner',
      items: [
        {
          label: 'Puntajes OKR',
          path: '/okr/scoring',
          icon: IconTarget,
          visible: () => true,
        },
        {
          label: 'Asignaciones',
          path: '/owner/assignments',
          icon: IconUserCog,
          visible: (r) => r === 'owner' || r === 'director',
        },
        {
          label: 'Mínimos semanales',
          path: '/settings/okr-minimums',
          icon: IconSlidersHorizontal,
          visible: () => true,
        },
      ],
    },
    {
      title: 'Cuenta',
      visible: () => true,
      items: [
        {
          label: 'Mi perfil',
          path: '/profile',
          icon: IconUser,
          visible: () => true,
        },
      ],
    },
  ]

  // Helper para verificar si una ruta está activa
  const checkIsActive = (path: string, exact?: boolean): boolean => {
    const currentPath = location.pathname
    const cleanPath = path.split('?')[0]
    
    if (exact) {
      return currentPath === cleanPath
    }
    
    // Para rutas con query params, verificar el path base
    if (path.includes('?')) {
      return currentPath === cleanPath || currentPath.startsWith(cleanPath + '/')
    }
    
    return currentPath === cleanPath || currentPath.startsWith(cleanPath + '/')
  }

  const handleNavClick = () => {
    // Cerrar drawer en mobile al navegar
    if (onNavigate) {
      onNavigate()
    }
    if (onClose) {
      onClose()
    }
  }

  // Cerrar drawer con ESC
  useEffect(() => {
    if (!isMobile || !isOpen) return

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isMobile, isOpen, onClose])

  // Prevenir scroll del body cuando drawer está abierto
  useEffect(() => {
    if (!isMobile) return

    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobile, isOpen])

  // Manejar tooltips en modo colapsado
  const handleMouseEnter = (label: string) => {
    if (!collapsed) return
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current)
    }
    setTooltipItem(label)
  }

  const handleMouseLeave = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current)
    }
    tooltipTimeoutRef.current = window.setTimeout(() => {
      setTooltipItem(null)
    }, 100)
  }

  // Filtrar secciones e items visibles
  const visibleSections = menuSections.filter((section) => section.visible(role, authLoading))

  return (
    <div
      className={`flex flex-col bg-surface border-r border-border transition-all duration-300 ${
        collapsed && !isMobile ? 'w-16' : 'w-64'
      } ${isMobile ? 'w-64 h-full' : 'h-full'}`}
    >
      {/* Logo/Header */}
      <div className={`px-4 pt-3 pb-2 border-b border-border flex flex-col items-center shrink-0 ${collapsed && !isMobile ? 'px-2' : ''}`}>
        {isMobile ? (
          // Móvil: siempre VantLogo, más grande
          <>
            <VantLogo size={48} mode="light" className="shrink-0 mx-auto" aria-label="vant" />
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 text-center">V 1.0</p>
          </>
        ) : collapsed ? (
          // Desktop colapsado: VantMark centrado
          <VantMark size={32} mode="light" className="shrink-0 mx-auto" aria-label="vant" />
        ) : (
          // Desktop expandido: VantLogo más grande
          <>
            <VantLogo size={48} mode="light" className="shrink-0 mx-auto" aria-label="vant" />
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 text-center">V 1.0</p>
          </>
        )}
      </div>

      {/* Botón colapsar (solo desktop) */}
      {!isMobile && (
        <div className="flex justify-end p-1.5 border-b border-border shrink-0">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 text-text hover:bg-black/5 rounded-lg transition-colors"
            aria-label={collapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
          >
            {collapsed ? <IconChevronRight className="w-4 h-4" /> : <IconChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      )}

      {/* Navigation - scrolleable */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-2" style={{ WebkitOverflowScrolling: 'touch' }}>
        {visibleSections.map((section, sectionIdx) => {
          const visibleItems = section.items.filter((item) => item.visible(role, authLoading))
          
          if (visibleItems.length === 0) return null

          return (
            <div key={sectionIdx}>
              {/* Título de sección */}
              {(!collapsed || isMobile) && (
                <div className="px-4 py-1 text-xs font-semibold text-muted uppercase tracking-wide mb-0.5">
                  {section.title}
                </div>
              )}
              {collapsed && !isMobile && (
                <div className="h-px bg-border my-1 mx-2" />
              )}

              {/* Items */}
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  const isActive = checkIsActive(item.path, item.exact)
                  const Icon = item.icon

                  return (
                    <div
                      key={item.path}
                      className="relative"
                      onMouseEnter={() => handleMouseEnter(item.label)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <NavLink
                        to={item.path}
                        end={item.exact}
                        className={({ isActive: navIsActive }) => {
                          const active = navIsActive || isActive
                          return `flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            collapsed && !isMobile ? 'justify-center px-2' : ''
                          } ${
                            active
                              ? 'bg-primary/10 text-primary border-l-4 border-primary'
                              : 'text-text hover:bg-black/5'
                          }`
                        }}
                        onClick={handleNavClick}
                      >
                        <Icon className="w-5 h-5 shrink-0" />
                        {(!collapsed || isMobile) && <span>{item.label}</span>}
                      </NavLink>

                      {/* Tooltip en modo colapsado */}
                      {collapsed && !isMobile && tooltipItem === item.label && (
                        <div className="absolute left-full ml-2 px-2 py-1 bg-black text-white text-xs rounded whitespace-nowrap z-50 pointer-events-none">
                          {item.label}
                          <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-4 border-transparent border-r-black" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* Footer - sticky en móvil */}
      <div
        className={`p-3 border-t border-border space-y-1.5 shrink-0 bg-surface ${
          collapsed && !isMobile ? 'px-2' : ''
        } ${isMobile ? 'sticky bottom-0' : ''}`}
      >
        {(!collapsed || isMobile) && userEmail && (
          <div className="text-xs text-muted px-2 truncate mb-0.5">{userEmail}</div>
        )}
        <button
          onClick={() => {
            handleNavClick()
            onSignOut()
          }}
          className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium text-text hover:bg-black/5 transition-colors ${
            collapsed && !isMobile ? 'justify-center px-2' : ''
          }`}
        >
          <IconLogout className="w-5 h-5 shrink-0" />
          {(!collapsed || isMobile) && <span>Cerrar sesión</span>}
        </button>
      </div>
    </div>
  )
}
