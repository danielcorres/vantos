import { useEffect, useState, useRef } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../shared/auth/AuthProvider'
import { Sidebar } from './Sidebar'
import { IconMenu, IconX } from './icons'
import { getUserDisplayName } from '../../lib/profile'
import { VantMark } from '../../components/branding/VantMark'

export function AppShell() {
  const navigate = useNavigate()
  const { user, loading: authLoading, error: authError, signOut } = useAuth()
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const mountedRef = useRef(true)
  const displayNameLoadedRef = useRef(false)

  // Cargar nombre de perfil cuando user cambia
  useEffect(() => {
    if (!user || displayNameLoadedRef.current) return

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
  }, [user])

  // Resetear displayNameLoadedRef cuando user cambia
  useEffect(() => {
    displayNameLoadedRef.current = false
  }, [user?.id])

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
      <div className="flex flex-col justify-center items-center min-h-screen gap-4">
        <VantMark size={48} mode="light" animated aria-label="VANT" />
        <span className="text-muted">Cargando...</span>
        {authError && (
          <div className="card p-4 max-w-md text-center">
            <div className="text-sm text-red-700 mb-3">{authError}</div>
            <button
              onClick={() => signOut()}
              className="btn text-sm border border-border"
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
      <div className="flex flex-col justify-center items-center min-h-screen gap-4">
        <VantMark size={40} mode="light" animated aria-label="VANT" />
        <span className="text-muted">Redirigiendo...</span>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 border-r border-border bg-surface sticky top-0 h-screen overflow-hidden">
        <Sidebar userEmail={displayName || user.email || undefined} onSignOut={handleSignOut} />
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-50 bg-surface border-b border-border">
        <div className="flex items-center justify-between h-14 px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 text-text hover:bg-black/5 rounded-lg transition-colors"
            aria-label="Abrir menú"
          >
            <IconMenu />
          </button>
          <div className="flex items-center gap-2">
            <VantMark size={28} mode="light" aria-label="VANT" />
            <span className="text-base font-semibold text-text">VANT</span>
          </div>
          <div className="w-9" /> {/* Spacer */}
        </div>
      </header>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          {/* Sidebar Panel */}
          <aside className="fixed top-0 left-0 bottom-0 w-64 bg-surface border-r border-border z-50 md:hidden shadow-xl">
            <div className="flex items-center justify-between p-4 border-b border-border h-14">
              <h2 className="text-base font-semibold text-text">Menú</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 text-text hover:bg-black/5 rounded-lg transition-colors"
                aria-label="Cerrar menú"
              >
                <IconX />
              </button>
            </div>
            <div className="h-[calc(100vh-3.5rem)] overflow-y-auto">
              <Sidebar
                userEmail={displayName || user.email || undefined}
                onSignOut={handleSignOut}
                onNavigate={() => setSidebarOpen(false)}
              />
            </div>
          </aside>
        </>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <main className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto pt-14 md:pt-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
