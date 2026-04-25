import { useToast, type ToastKind } from '../components/ToastContext'
import { toastMessage, type ToastMessageKey } from './toastMessages'

type NotifyOptions = { durationMs?: number }

export function useNotify() {
  const { showToast } = useToast()

  const notify = (kind: ToastKind, key: ToastMessageKey, options?: NotifyOptions) => {
    showToast(toastMessage(key), kind, options)
  }

  return {
    success: (key: ToastMessageKey, options?: NotifyOptions) => notify('success', key, options),
    error: (key: ToastMessageKey, options?: NotifyOptions) => notify('error', key, options),
    info: (key: ToastMessageKey, options?: NotifyOptions) => notify('info', key, options),
    raw: (message: string, kind: ToastKind = 'success', options?: NotifyOptions) =>
      showToast(message, kind, options),
  }
}
