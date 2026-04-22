import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './routes'
import { AuthProvider } from '../shared/auth/AuthProvider'

export default function App() {
  // Tema siempre claro: no sincronizar con prefers-color-scheme (html sin clase dark).
  useEffect(() => {
    document.documentElement.classList.remove('dark')
  }, [])

  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
