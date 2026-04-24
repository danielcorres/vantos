export type AssignmentProfileRole =
  | 'owner'
  | 'manager'
  | 'recruiter'
  | 'advisor'
  | 'director'
  | 'seguimiento'

export type AccountStatus = 'active' | 'suspended'

export type AssignmentProfile = {
  user_id: string
  full_name: string | null
  display_name: string | null
  role: AssignmentProfileRole
  account_status: AccountStatus
  manager_user_id: string | null
  recruiter_user_id: string | null
  manager_assigned_by: string | null
  manager_assigned_at: string | null
  recruiter_assigned_by: string | null
  recruiter_assigned_at: string | null
<<<<<<< HEAD
  /** Baja de agencia: cuenta suspendida y oculta por defecto en asignaciones */
=======
>>>>>>> develop
  archived_at: string | null
  archived_by: string | null
}

export type AdvisorSeguimientoRow = {
  advisor_user_id: string
  seguimiento_user_id: string
  assigned_by: string | null
  assigned_at: string
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export type RowSaveState = Record<string, SaveState>

export const ROLES_EDITABLE = [
  'advisor',
  'manager',
  'recruiter',
  'director',
  'seguimiento',
] as const

export type EditableRole = (typeof ROLES_EDITABLE)[number]

export function isEditableAssignmentRole(
  role: AssignmentProfile['role']
): role is EditableRole {
  return (ROLES_EDITABLE as readonly string[]).includes(role)
}
