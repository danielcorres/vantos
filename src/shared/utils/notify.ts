import { useMemo } from 'react'
import { useToast, type ToastKind } from '../components/ToastContext'
import { toastMessage, type ToastMessageKey } from './toastMessages'

type NotifyOptions = { durationMs?: number }

export function useNotify() {
  const { showToast } = useToast()

  return useMemo(
    () => ({
      success: (key: ToastMessageKey, options?: NotifyOptions) =>
        showToast(toastMessage(key), 'success', options),
      error: (key: ToastMessageKey, options?: NotifyOptions) =>
        showToast(toastMessage(key), 'error', options),
      info: (key: ToastMessageKey, options?: NotifyOptions) =>
        showToast(toastMessage(key), 'info', options),
      raw: (message: string, kind: ToastKind = 'success', options?: NotifyOptions) =>
        showToast(message, kind, options),
    }),
    [showToast]
  )
}
