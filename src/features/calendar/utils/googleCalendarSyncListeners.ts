/** Suscriptores a errores de push Google (desde `invokeGoogleCalendarSync`). */
const listeners = new Set<(message: string) => void>()

export function subscribeGoogleCalendarSyncErrors(cb: (message: string) => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function emitGoogleCalendarSyncError(message: string): void {
  for (const cb of listeners) {
    try {
      cb(message)
    } catch {
      /* ignore */
    }
  }
}
