import { createContext, useCallback, useContext, useRef, useState } from 'react'

export type ToastKind = 'success' | 'error' | 'info'

interface ToastItem {
  id: number
  message: string
  kind: ToastKind
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind, options?: { durationMs?: number }) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DURATION_MS_BY_KIND: Record<ToastKind, number> = {
  success: 2200,
  error: 3200,
  info: 2600,
}
const DEDUPE_WINDOW_MS = 900

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)
  const lastShownRef = useRef<{ message: string; kind: ToastKind; at: number } | null>(null)

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback((message: string, kind: ToastKind = 'success', options?: { durationMs?: number }) => {
    const clean = message.trim()
    if (!clean) return
    const now = Date.now()
    const last = lastShownRef.current
    if (last && last.message === clean && last.kind === kind && now - last.at < DEDUPE_WINDOW_MS) {
      return
    }
    lastShownRef.current = { message: clean, kind, at: now }
    const id = ++counter.current
    setToasts((prev) => [...prev, { id, message: clean, kind }])
    const ms = options?.durationMs ?? DURATION_MS_BY_KIND[kind]
    setTimeout(() => removeToast(id), ms)
  }, [removeToast])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className={`px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium pointer-events-auto transition-all animate-fade-in-up
                ${t.kind === 'success' ? 'bg-green-700 text-white' : ''}
                ${t.kind === 'error' ? 'bg-red-600 text-white' : ''}
                ${t.kind === 'info' ? 'bg-neutral-800 text-white' : ''}
              `}
            >
              {t.message}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
