/**
 * Textos amigables cuando Google redirige a la app con ?google_calendar=error&reason=...
 * (la pantalla de error de Google no es configurable desde nuestro código).
 */
export function formatGoogleCalendarReturnError(detailRaw: string): string {
  const detail = detailRaw.trim().toLowerCase()

  if (detail === 'access_denied') {
    return (
      'No se conectó Google Calendar: la cuenta no tiene permiso en este momento. ' +
      'Si la app de Google está en modo prueba, un administrador debe añadir tu correo en ' +
      'Google Cloud (Pantalla de consentimiento OAuth → Usuarios de prueba) o publicar la app. ' +
      'Si cerraste la ventana de Google sin aceptar, vuelve a intentar «Conectar».'
    )
  }

  if (detail.includes('no_refresh_token') || detail.includes('prompt_consent')) {
    return (
      'Google no devolvió permiso persistente al calendario. Vuelve a conectar y en la pantalla de Google ' +
      'elige la cuenta correcta y acepta todos los permisos (incluido acceso al calendario).'
    )
  }

  if (detail === 'invalid_state') {
    return 'La sesión de conexión expiró o no es válida. Cierra esta pestaña, abre de nuevo Calendario o Perfil e intenta conectar otra vez.'
  }

  if (detailRaw.trim()) {
    return `No se pudo conectar Google Calendar: ${detailRaw.trim()}`
  }
  return 'No se pudo conectar Google Calendar. Revisa la configuración o inténtalo de nuevo.'
}
