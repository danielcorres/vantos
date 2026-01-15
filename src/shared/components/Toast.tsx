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
    <div className={`toast toast--${type}`}>
      <span className="toast__msg">{message}</span>
      <button className="toast__x" onClick={onClose} aria-label="Cerrar">
        ×
      </button>
    </div>
  )
}
