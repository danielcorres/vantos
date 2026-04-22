import { useEffect, useState, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../shared/auth/AuthProvider'
import { Sidebar } from './Sidebar'
import { IconMenu, IconX } from './icons'
import { getUserDisplayName } from '../../lib/profile'
import { VantMark } from '../../components/branding/VantMark'
import { VantLogo } from '../../components/branding/VantLogo'

const SIDEBAR_EXPANDED = 256 // 64 * 4 (w-64)
const SIDEBAR_COLLAPSED = 64 // w-16

export function AppShell() {
  const navigate = useNavigate()
  const { user, loading: authLoading, error: authError, signOut } = useAuth()
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const mountedRef = useRef(true)
  const displayNameLoadedRef = useRef(false)

  // Calcular width del sidebar en desktop
  const sidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED

  // Resetear displayNameLoadedRef cuando cambia el usuario (antes de cargar nombre)
  useEffect(() => {
    displayNameLoadedRef.current = false
  }, [user?.id])

  // Depender de user?.id, no de user: cada TOKEN_REFRESHED crea un nuevo objeto user
  // y volver a llamar getUserDisplayName() -> auth.getUser() puede re-disparar onAuthStateChange (bucle).
  useEffect(() => {
    if (!user?.id || displayNameLoadedRef.current) return

    const loadDisplayName = async () => {
      try {
        const name = await getUserDisplayName()
        if (mountedRef.current) {
          setDisplayName(name || user.email || null)
          displayNameLoadedRef.current = true
        }
      } catch (err) {
        console.warn('[AppShell] Error al cargar nombre de perfil:', err)
        if (mountedRef.current) {
          setDisplayName(user.email || null)
          displayNameLoadedRef.current = true
        }
      }
    }

    loadDisplayName()
  }, [user?.id, user?.email])

  // Redirigir a login si no hay sesión
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true })
    }
  }, [authLoading, user, navigate])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      displayNameLoadedRef.current = false
    }
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  if (authLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen gap-4 bg-bg dark:bg-neutral-950">
        <VantMark size={48} animated aria-label="VANT" />
        <span className="text-muted dark:text-neutral-400">Cargando...</span>
        {authError && (
          <div className="card p-4 max-w-md text-center">
            <div className="text-sm text-red-700 dark:text-red-300 mb-3">{authError}</div>
            <button
              onClick={() => signOut()}
              className="btn text-sm border border-border dark:border-neutral-600"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen gap-4 bg-bg dark:bg-neutral-950">
        <VantMark size={40} animated aria-label="VANT" />
        <span className="text-muted dark:text-neutral-400">Redirigiendo...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg dark:bg-neutral-950 flex">
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:block border-r border-border bg-surface dark:bg-neutral-900 dark:border-neutral-800 sticky top-0 h-screen overflow-hidden transition-all duration-300"
        style={{ width: `${sidebarWidth}px` }}
      >
        <Sidebar
          userEmail={displayName || user.email || undefined}
          onSignOut={handleSignOut}
          isMobile={false}
          onCollapsedChange={setSidebarCollapsed}
        />
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-surface dark:bg-neutral-900 border-b border-border dark:border-neutral-800">
        <div className="flex items-center justify-center h-14 px-4 relative">
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute left-4 p-2 text-text dark:text-neutral-100 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Abrir menú"
          >
            <IconMenu />
          </button>
          <VantLogo size={32} mode="light" className="mx-auto" aria-label="vant" />
        </div>
      </header>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <>
          {/* Overlay semitransparente */}
          <div
            className="fixed inset-0 bg-black/50 z-50 md:hidden transition-opacity"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          {/* Sidebar Panel */}
          <aside
            className="fixed top-0 left-0 w-64 bg-surface dark:bg-neutral-900 border-r border-border dark:border-neutral-800 z-50 md:hidden shadow-xl transform transition-transform flex flex-col"
            style={{ height: '100dvh' }}
            role="dialog"
            aria-modal="true"
            aria-label="Menú de navegación"
          >
            <div className="flex items-center justify-between p-4 border-b border-border dark:border-neutral-800 h-14 shrink-0">
              <h2 className="text-base font-semibold text-text dark:text-neutral-100">Menú</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 text-text dark:text-neutral-100 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors"
                aria-label="Cerrar menú"
              >
                <IconX />
              </button>
            </div>
            <Sidebar
              userEmail={displayName || user.email || undefined}
              onSignOut={handleSignOut}
              onNavigate={() => setSidebarOpen(false)}
              isMobile={true}
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
            />
          </aside>
        </>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 pt-14 md:pt-0">
          <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
            <Outlet />
          </div>
        </main>
        {/* Footer Global */}
        <footer className="border-t border-border dark:border-neutral-800 bg-surface dark:bg-neutral-900 py-4 px-4 sm:px-6 lg:px-8">
          <div className="w-full max-w-screen-2xl mx-auto text-center">
            <p className="text-xs text-muted dark:text-neutral-400">
              Todos los derechos reservados © Vant 2026
            </p>
          </div>
        </footer>
      </div>
    </div>
  )
}
