# RUNBOOK — Vant

## Arranque
- npm install
- npm run dev

## Variables de entorno
Ver `.env.example`

## Supabase
- Migraciones en `supabase/migrations/`
- Seeds en `supabase/seed.sql`

## Reglas
- No cambios manuales en DB fuera de migraciones
- Si hay decisión nueva: actualizar `PROJECT_CONTEXT.md` + registrar en `docs/DECISIONS.md`
