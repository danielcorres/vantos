/**
 * Role and auth types for RoleGuard and auth module.
 */

export type Role =
  | 'advisor'
  | 'owner'
  | 'manager'
  | 'recruiter'
  | 'director'
  | 'seguimiento'
  | 'developer'
  | 'super_admin'

export type AllowedRoles = readonly Role[] | readonly string[]
