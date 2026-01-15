/**
 * Utilidades de acceso y autorización
 */

/**
 * Verificar si un usuario es el System Owner
 * @param userId ID del usuario a verificar
 * @param systemOwnerId ID del System Owner (puede ser null si aún no está cargado)
 * @returns true si userId === systemOwnerId y ambos no son null
 */
export function isSystemOwner(
  userId: string | null | undefined,
  systemOwnerId: string | null
): boolean {
  if (!userId || !systemOwnerId) {
    return false
  }
  return userId === systemOwnerId
}
