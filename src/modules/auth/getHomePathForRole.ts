/**
 * Returns the home path for a given profile role.
 * Used for post-login redirect by role.
 */
export function getHomePathForRole(role: string | null | undefined): string {
  switch (role) {
    case 'owner':
      return '/owner/assignments'
    case 'director':
      return '/'
    case 'manager':
      return '/'
    case 'recruiter':
      return '/'
    case 'seguimiento':
      return '/'
    default:
      return '/'
  }
}
