# Dev Seeds

Esta carpeta contiene scripts SQL de datos de prueba para entornos locales y staging.

## Qué son los dev seeds

Son archivos SQL que insertan datos de ejemplo para facilitar el desarrollo y las pruebas. No son migraciones de esquema.

## Diferencia con las migraciones

| | `supabase/migrations/` | `supabase/dev-seeds/` |
|---|---|---|
| Propósito | Estructura del schema (tablas, índices, RLS, RPCs) | Datos de prueba |
| Se aplica con `supabase db push` | Sí, automáticamente | No, nunca automáticamente |
| Se aplica en producción | Sí | No |
| Es idempotente | Depende | Sí (ON CONFLICT DO NOTHING) |

## Cómo ejecutar un seed manualmente

Solo en entorno local o staging controlado. Nunca en producción.

**Opción 1 — psql directo:**

```bash
psql "$DATABASE_URL" -f supabase/dev-seeds/campaigns_dev_seed.sql
```

**Opción 2 — Supabase CLI (instancia local activa):**

```bash
supabase db execute --file supabase/dev-seeds/campaigns_dev_seed.sql
```

Asegúrate de que las migraciones reales del módulo ya estén aplicadas antes de ejecutar el seed:

```
20260501120000_campaigns_module.sql
20260501130000_campaigns_rpcs.sql
```

## Archivos disponibles

| Archivo | Módulo | Descripción |
|---|---|---|
| `campaigns_dev_seed.sql` | Campañas | 3 campañas de ejemplo: Fan Fest (fixed_period), Camino a la Cumbre (new_advisor_path), Legión Centurión (multi_track con 4 tracks) |

## Advertencias

- Estos seeds usan UUIDs fijos (prefijo `a1000000-`) para ser idempotentes. Si ya existen, no se duplican.
- No crean usuarios, perfiles ni snapshots reales.
- No hay tablas específicas por campaña. Todo va en tablas genéricas (`campaigns`, `campaign_tracks`, `campaign_levels`).
- No se usa `organization_id` en ningún seed.
