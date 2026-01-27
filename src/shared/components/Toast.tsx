import { useEffect } from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  onClose: () => void
  durationMs?: number
}

export function Toast({ message, type = 'info', onClose, durationMs = 1800 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose()
    }, durationMs)

    return () => clearTimeout(timer)
  }, [durationMs, onClose])

  return (
    <div 
      className={`toast toast--${type}`} 
      style={{
        animation: 'fadeInUp 200ms ease-out',
      }}
    >
      <span className="toast__msg">{message}</span>
    </div>
  )
}
