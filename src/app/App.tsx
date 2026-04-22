import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './routes'
import { AuthProvider } from '../shared/auth/AuthProvider'

export default function App() {
  // Tema siempre claro: quitar `dark` de <html> si aparece (Tailwind + extensiones / UA).
  useEffect(() => {
    const html = document.documentElement
    const stripDark = () => {
      html.classList.remove('dark')
    }
    stripDark()
    const observer = new MutationObserver(stripDark)
    observer.observe(html, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
