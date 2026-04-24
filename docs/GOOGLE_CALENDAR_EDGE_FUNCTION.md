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

No hace falta definir manualmente: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (los inyecta Supabase).

Ejemplo CLI (prod):

```bash
supabase secrets set --project-ref lyvnyjkfgkbrobetzxvs \
  GOOGLE_CLIENT_ID="..." \
  GOOGLE_CLIENT_SECRET="..." \
  OAUTH_STATE_SECRET="..." \
  APP_SITE_URL="https://..."
```

## Google Cloud Console — Redirect URI

En **APIs & Services → Credentials → OAuth 2.0 Client ID → Authorized redirect URIs**, añade **una URI por proyecto Supabase**:

**Producción** (`lyvnyjkfgkbrobetzxvs`):

```
https://lyvnyjkfgkbrobetzxvs.supabase.co/functions/v1/google-calendar?action=callback
```

**Staging** (`cayibyaingcvhzwhfrhy`):

```
https://cayibyaingcvhzwhfrhy.supabase.co/functions/v1/google-calendar?action=callback
```

## Verificación

1. Dashboard → Edge Functions → `google-calendar` desplegada.
2. Conectar Google desde Perfil o Calendario en la app apuntando a ese proyecto.
3. `supabase functions list --project-ref <REF>` debe listar `google-calendar`.
