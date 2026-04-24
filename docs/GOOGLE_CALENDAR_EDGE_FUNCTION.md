# Edge Function `google-calendar` (producción / staging)

## Despliegue

Siempre con **`--no-verify-jwt`**: el callback OAuth de Google es un `GET` sin cabecera `Authorization`.

```bash
# Proyecto enlazado localmente (`supabase link`)
npm run functions:deploy

# Staging / prod (refs del repo)
npm run functions:deploy:staging
npm run functions:deploy:prod
```

## Secretos (Dashboard: Edge Functions → Secrets, o CLI)

En **cada** proyecto (staging y prod) deben existir:

| Secreto | Descripción |
|--------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth Client ID (Google Cloud Console) |
| `GOOGLE_CLIENT_SECRET` | OAuth Client secret |
| `OAUTH_STATE_SECRET` | Cadena aleatoria larga, ej. `openssl rand -hex 32` |
| `APP_SITE_URL` | URL pública de la app, ej. `https://tu-dominio.com` |

Supabase suele inyectar `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_ANON_KEY` en Edge Functions. Si en logs ves `missing_keys` con `SUPABASE_ANON_KEY`, añádelo como secreto en el dashboard (valor = **anon public** del proyecto en Settings → API).

Ejemplo CLI (prod):

```bash
supabase secrets set --project-ref lyvnyjkfgkbrobetzxvs \
  GOOGLE_CLIENT_ID="..." \
  GOOGLE_CLIENT_SECRET="..." \
  OAUTH_STATE_SECRET="..." \
  APP_SITE_URL="https://..."
```

## Pantalla de consentimiento OAuth (nombre que ve el usuario)

Google muestra su **propia** página de error (“acceso bloqueado”, verificación, etc.); **no** se puede sustituir por código de Vant.

Para que en el consentimiento no predomine un dominio raro:

1. **APIs y servicios** → **Pantalla de consentimiento de OAuth**.
2. **Nombre de la aplicación**: pon algo reconocible, p. ej. **“Vant”** o **“Asesores Consulta”** (no dejes el nombre por defecto ligado al proyecto).
3. **Correo de asistencia al usuario** y **Dominios autorizados** según lo que pida el formulario.
4. Para que los asesores **no** vean el bloqueo de “app en prueba”: **Usuarios de prueba** (añade sus correos) o **Publicar** la aplicación cuando corresponda.

Cuando Google redirige de vuelta a tu app con `?google_calendar=error&reason=access_denied`, la interfaz de Vant muestra un mensaje en español orientativo (ver `formatGoogleCalendarReturnError`).

## Google Cloud Console — Redirect URI

En **APIs & Services → Credentials → OAuth 2.0 Client ID → Authorized redirect URIs**, añade **exactamente** esta URI (HTTPS, con `/functions/v1/`). Comprueba que la ruta contenga la palabra **`google-calendar`** completa, no un typo tipo `google-calenc` (Google devuelve `redirect_uri_mismatch`). No uses `http://` ni omitas `/functions/v1/`.

**Producción** (`lyvnyjkfgkbrobetzxvs`):

```
https://lyvnyjkfgkbrobetzxvs.supabase.co/functions/v1/google-calendar?action=callback
```

**Staging** (`cayibyaingcvhzwhfrhy`):

```
https://cayibyaingcvhzwhfrhy.supabase.co/functions/v1/google-calendar?action=callback
```

## Si ves HTTP 503 al conectar o al estado de Google Calendar

La función responde `503` con cuerpo `{ "error": "server_misconfigured", "missing_keys": [...] }` cuando **falta alguno** de estos secretos en el proyecto (prod o staging):

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `OAUTH_STATE_SECRET`.

En el dashboard: **Project Settings → Edge Functions → Secrets** (o la sección de secretos por función) y define cada clave. Además define **`APP_SITE_URL`** (p. ej. `https://vant.asesoresconsulta.com`) aunque no dispare el 503 por sí sola, la necesita OAuth y redirects.

Tras guardar secretos, no hace falta redeploy: la próxima invocación ya los lee.

## Verificación

1. Dashboard → Edge Functions → `google-calendar` desplegada.
2. Conectar Google desde Perfil o Calendario en la app apuntando a ese proyecto.
3. `supabase functions list --project-ref <REF>` debe listar `google-calendar`.
