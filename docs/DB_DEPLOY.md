# DB Deploy (Supabase) – VANT-OS

Este repo maneja 2 ambientes:

- STAGING: `cayibyaingcvhzwhfrhy` (Vantos-Staging)
- PROD: `lyvnyjkfgkbrobetzxvs` (Vantos)

## Regla de oro
Siempre aplicar migraciones primero en STAGING, validar, y luego en PROD.

## Comandos (desde la raíz del repo)

### STAGING
```bash
npm run db:link:staging
npm run db:where
npm run db:push

Ambientes:
- STAGING: cayibyaingcvhzwhfrhy (Vantos-Staging)
- PROD: lyvnyjkfgkbrobetzxvs (Vantos)

## Regla de oro
Primero STAGING, validar, luego PROD.

## STAGING
npm run db:link:staging
npm run db:where
npm run db:push

## PROD
npm run db:link:prod
npm run db:where
npm run db:push

## Verificación
db:where imprime el project-ref actual.
EOF

git add docs/DB_DEPLOY.md
git commit -m "docs: add DB deploy playbook for staging and prod"
git push