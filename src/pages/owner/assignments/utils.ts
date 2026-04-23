import type { AssignmentProfile } from './types'

export function getAssignmentDisplayName(
  p: Pick<AssignmentProfile, 'full_name' | 'display_name' | 'user_id'>
): string {
  return p.full_name || p.display_name || p.user_id.slice(0, 8)
}

export function formatAssignedAt(iso: string | null | undefined): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('es', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}
