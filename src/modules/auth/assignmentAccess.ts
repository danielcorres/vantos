/** Roles que pueden abrir la página de Asignaciones (ruta + sidebar + UI). */
export const ASSIGNMENTS_PAGE_ROLES = ['owner', 'director', 'seguimiento', 'developer'] as const

export type AssignmentsPageRole = (typeof ASSIGNMENTS_PAGE_ROLES)[number]

export function isAssignmentsPageRole(role: string | null | undefined): role is AssignmentsPageRole {
  return role != null && (ASSIGNMENTS_PAGE_ROLES as readonly string[]).includes(role)
}

/** Edición completa: roles, manager/recruiter y asignaciones arbitrarias. */
export const ASSIGNMENTS_ADMIN_ROLES = ['owner', 'director'] as const

export type AssignmentsAdminRole = (typeof ASSIGNMENTS_ADMIN_ROLES)[number]

export function isAssignmentsAdmin(role: string | null | undefined): boolean {
  return role != null && (ASSIGNMENTS_ADMIN_ROLES as readonly string[]).includes(role)
}
