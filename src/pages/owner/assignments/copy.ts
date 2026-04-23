/** Etiquetas de rol en español (valor BD sin cambiar) */
export function roleLabelEs(role: string): string {
  switch (role) {
    case 'director':
      return 'Directivo'
    case 'manager':
      return 'Manager'
    case 'recruiter':
      return 'Recluta'
    case 'seguimiento':
      return 'Seguimiento'
    case 'advisor':
      return 'Asesor'
    case 'owner':
      return 'Owner'
    default:
      return role
  }
}
