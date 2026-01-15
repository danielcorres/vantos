import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import './Layout.css'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="layout">
      <aside className="sidebar">
        <h2 className="sidebar-title">vant-os</h2>
        <nav className="sidebar-nav">
          <Link
            to="/activity"
            className={`nav-link ${isActive('/activity') ? 'active' : ''}`}
          >
            Actividad
          </Link>
          <Link
            to="/settings/points"
            className={`nav-link ${isActive('/settings/points') ? 'active' : ''}`}
          >
            Configuración
          </Link>
          <Link
            to="/leaderboard"
            className={`nav-link ${isActive('/leaderboard') ? 'active' : ''}`}
          >
            Clasificación
          </Link>
        </nav>
        <button className="logout-btn" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  )
}

