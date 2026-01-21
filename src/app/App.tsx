import { RouterProvider } from 'react-router-dom'
import { router } from './routes'
import { AuthProvider } from '../shared/auth/AuthProvider'
import { useAutoDarkClass } from '../shared/hooks/useAutoDarkClass'

export default function App() {
  useAutoDarkClass()

  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
