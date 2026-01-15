PROJECT_CONTEXT — VANT (Sistema Interno)

1. PROPÓSITO DEL PROYECTO

VANT es un sistema operativo interno para una sola agencia de seguros (NO SaaS).

Objetivos principales:
- Acompañar la ejecución diaria del asesor
- Medir actividad real, no solo resultados finales
- Dar visibilidad operativa y accionable a líderes (Owner, Managers)
- Facilitar coaching, seguimiento y toma de decisiones con datos reales
- Convertir actividad → disciplina → resultados

VANT está diseñado para ser usado todos los días como sistema de operación, no como una herramienta de reporting ocasional.


2. ALCANCE Y RESTRICCIONES ESTRUCTURALES (NO NEGOCIABLES)

- Sistema para una sola agencia
- No multi-tenant
- No existe tabla organizations
- No existe organization_id
- Todos los usuarios pertenecen al mismo despacho
- El aislamiento de datos se hace por:
  - auth.uid()
  - relaciones explícitas (ej. manager_user_id)
- Supabase es el backend único (DB, Auth, RLS, RPCs)


3. ESTADO ACTUAL DEL PROYECTO (ENERO 2026)

OKR v0 + Dashboards operativos funcionan end-to-end.

Completado y validado:
- Supabase local funcionando
- Migraciones base aplicadas
- RLS activo y validado
- RPCs críticos funcionando
- OKR Diario y Semanal
- Pipeline v0 integrado a OKR
- Dashboards Owner y Manager operativos
- Detalle semanal por asesor (read-only)
- Labels de métricas unificados
- Manejo de fechas y timezone validado

Pendiente / siguiente fase:
- Pulido visual y micro-interacciones
- Comparativo semana vs semana anterior
- Insights clicables (dashboard → acción)
- Prueba con usuarios reales y ajustes de flujo
- Eventual paso a Supabase Cloud


4. STACK TECNOLÓGICO

Frontend:
- Vite
- React
- TypeScript
- Arquitectura modular por dominio
- Tailwind CSS
- UI enfocada en rapidez y claridad operativa

Backend:
- Supabase
- Postgres como fuente única de verdad
- RLS activo por defecto
- Migraciones SQL versionadas
- RPCs solo cuando reducen complejidad o mejoran consistencia

Timezone:
- America/Monterrey es la zona horaria canónica del sistema


5. DOMINIO OKR (DECISIONES CERRADAS)

5.1 Métricas OKR

Las métricas se identifican únicamente por metric_key.

Ejemplos:
- calls
- meetings_set
- meetings_held
- proposals_presented
- applications_submitted
- referrals
- policies_paid

Decisión crítica:
El dominio OKR es el único dueño de los nombres visibles de las métricas.

Existe una sola fuente canónica de labels:
src/modules/okr/domain/metricLabels.ts

Regla:
- Ningún dashboard, helper o componente puede hardcodear nombres de métricas
- Todos los módulos consumen los labels desde el dominio OKR


5.2 Puntos y metas

- Puntos por métrica: okr_metric_scores_global
- Settings globales:
  - daily_base_target
  - weekly_days

Meta semanal:
weeklyTarget = daily_base_target * weekly_days

Los cálculos no se duplican y viven en helpers puros:
- computeAdvisorWeekStats
- computeAdvisorHistoryStats


6. ARQUITECTURA DE DASHBOARDS

6.1 Hook central compartido

Toda la lógica de carga, scope y cálculo vive en:
src/modules/okr/dashboard/useTeamOkrDashboard.ts

Características:
- Reutiliza los mismos cálculos OKR
- No toca RLS
- No usa jwt()
- Maneja loading, errores y race conditions

Scope automático por rol:
- Owner:
  - Ve todos los advisors
  - Puede filtrar por manager / recruiter
- Manager:
  - Ve solo advisors donde profiles.manager_user_id = auth.uid()
  - Sin filtros adicionales


6.2 Dashboards

Owner Dashboard:
- Vista global del equipo
- Leaderboard semanal
- Consistencia histórica (12 semanas)
- Acceso a detalle por asesor

Manager Dashboard:
- Métricas idénticas al Owner
- Scope automático al equipo del manager
- Acceso a detalle semanal por asesor


7. DETALLE SEMANAL DEL ASESOR

Ruta:
/manager/advisor/:advisorId

Características:
- Read-only
- Accesible para Owner y Manager
- Usa los mismos cálculos OKR
- Sin lógica duplicada
- Sin hooks condicionales

Bloques implementados:
1. Resumen semanal
2. Insights accionables
3. Desglose por métrica
4. Línea de tiempo semanal (Lunes–Domingo)
5. Plan para cumplir (multi-día, con simulación)


8. MANEJO DE FECHAS Y TIMEZONE

Reglas cerradas:
- Toda lógica usa strings YYYY-MM-DD
- Comparaciones no dependen del timezone del navegador
- Render de fechas con Date.UTC
- Conversión de eventos con timestampToYmdInTz(date, America/Monterrey)

Esto evita bugs por DST y desfases entre frontend y DB.


9. SEGURIDAD, RLS Y RPCs

- RLS activo en todas las tablas de negocio
- El frontend no bypassea RLS
- RPCs críticos:
  - upsert_daily_metrics
  - void_last_event_today
- RPCs usan auth.uid()
- Permisos explícitos y mínimos


10. MOTOR DE EVENTOS (NÚCLEO DEL SISTEMA)

Entidad central: activity_events

Campos clave:
- actor_user_id
- metric_key
- value
- recorded_at (fuente de verdad temporal)
- happened_at (informativo)
- source
- idempotency_key
- metadata

Reglas:
- Los eventos no se editan: se void con auditoría
- Idempotencia obligatoria
- Recalculo determinista a partir de eventos


11. PIPELINE V0 (INTEGRADO)

- CRUD de leads
- Kanban drag & drop
- Auditoría completa (lead_stage_history)
- RPC move_lead_stage
- Auto-log en activity_events
- Alimenta OKR y racha
- Idempotencia por buckets de tiempo


12. PRINCIPIOS RECTORES

- El sistema guía, no castiga
- La constancia importa más que el resultado aislado
- La UI interpreta, no decide
- Evitar duplicación de lógica
- Centralizar helpers
- Preferir claridad sobre complejidad


13. ESTRATEGIA DE PRUEBAS (MVP)

- Pruebas de DB: constraints, RLS, RPCs
- Pruebas de lógica: puntos, semanas, timezone, idempotencia
- Pruebas de UI: registro, undo, dashboards coherentes


14. ROADMAP INMEDIATO

1. Pulido UX
2. Comparativo semana vs semana anterior
3. Insights clicables
4. Gamificación ligera
5. Uso real y ajustes


15. REGLA DE DESARROLLO (NO NEGOCIABLE)

Si algo no se usaría mañana por un asesor o manager, no se construye hoy.


16. USO DE ESTE DOCUMENTO

- Fuente de verdad del proyecto
- No es bitácora de prompts
- Toda decisión estructural nueva debe quedar aquí antes de escribir código

# PROJECT_CONTEXT — VANT (Sistema Interno)

---

## 1. PROPÓSITO DEL PROYECTO

VANT es un sistema operativo interno para **una sola agencia de seguros** (NO SaaS).

Objetivos principales:
- Acompañar la ejecución diaria del asesor
- Medir **actividad real**, no solo resultados finales
- Dar visibilidad **operativa y accionable** a líderes (Owner, Managers)
- Facilitar coaching, seguimiento y toma de decisiones con datos reales
- Convertir **actividad → disciplina → resultados**

VANT está diseñado para ser usado **todos los días** como sistema de operación, no como una herramienta de reporting ocasional.

---

## 2. ALCANCE Y RESTRICCIONES ESTRUCTURALES (NO NEGOCIABLES)

- Sistema para **una sola agencia**
- NO multi-tenant
- NO existe tabla `organizations`
- NO existe `organization_id`
- Todos los usuarios pertenecen al mismo despacho
- El aislamiento de datos se hace por:
  - `auth.uid()`
  - relaciones explícitas (ej. `manager_user_id`)
- Supabase es el backend único:
  - Base de datos
  - Auth
  - RLS
  - RPCs
  - Migraciones

---

## 3. ESTADO ACTUAL DEL PROYECTO (ENERO 2026)

**OKR v0 + Dashboards operativos funcionan end-to-end** en Local y Cloud.

### Completado y validado
- Supabase local y cloud funcionando
- Migraciones **sincronizadas (Local = Cloud)**
- RLS activo y validado
- RPCs críticos endurecidos
- OKR Diario y Semanal
- Pipeline v0 integrado a OKR
- Dashboards Owner y Manager operativos
- Detalle semanal por asesor (read-only)
- Catálogo maestro de métricas OKR
- FK y validaciones activas
- Manejo de fechas y timezone validado

### Pendiente / siguiente fase
- Pulido visual y micro-interacciones
- Comparativo semana vs semana anterior
- Insights clicables (dashboard → acción)
- Gamificación ligera
- Uso real con usuarios y ajustes de flujo

---

## 4. STACK TECNOLÓGICO

### Frontend
- Vite
- React
- TypeScript
- Arquitectura modular por dominio
- Tailwind CSS
- UI enfocada en rapidez y claridad operativa

### Backend
- Supabase
- Postgres como **fuente única de verdad**
- RLS activo por defecto
- Migraciones SQL versionadas
- RPCs solo cuando:
  - reducen complejidad
  - o garantizan consistencia de dominio

### Timezone
- **America/Monterrey** es la zona horaria canónica del sistema

---

## 5. DOMINIO OKR (DECISIONES CERRADAS)

### 5.1 Métricas OKR — Catálogo y fuentes de verdad

Las métricas se identifican **únicamente** por `metric_key`.

Ejemplos:
- `calls`
- `meetings_set`
- `meetings_held`
- `proposals_presented`
- `applications_submitted`
- `referrals`
- `policies_paid`

### Catálogo maestro (decisión arquitectónica)

- **`public.metric_definitions`** es la **fuente única de verdad** de todas las métricas del sistema.
- `activity_events.metric_key` tiene **FK obligatoria** contra `metric_definitions.key`.
- Ningún evento puede existir con una `metric_key` no registrada.
- Incluye métricas OKR y métricas técnicas (ej. `pipeline.stage_moved`).

**Regla**
> Cualquier métrica nueva **debe sembrarse primero** en `metric_definitions` mediante migración.

---

### 5.2 Labels (UI)

- **`src/modules/okr/domain/metricLabels.ts`** es la **fuente canónica de labels UI**.
- Solo controla **nombres visibles**, no existencia en DB.

Reglas:
- Ningún componente puede hardcodear labels
- UI **no define métricas**
- Toda `metric_key` usada en UI **debe existir** en `metric_definitions`

---

### 5.3 Puntos y metas

- Puntos por métrica: `okr_metric_scores_global`
- Settings globales:
  - `daily_base_target`
  - `weekly_days`

Meta semanal:



Los cálculos viven en helpers puros:
- `computeAdvisorWeekStats`
- `computeAdvisorHistoryStats`

No se duplican cálculos.

---

## 6. RPC CRÍTICO — `upsert_daily_metrics`

El RPC `public.upsert_daily_metrics` está **endurecido y blindado**.

Garantías:
- Normaliza todas las `metric_key` (`trim + lower`)
- Valida **antes de insertar** contra `metric_definitions`
- Si alguna key no existe:
  - lanza error explícito  
    `Unknown metric_key(s) in payload`
- Respeta RLS
- Usa `auth.uid()`
- No edita eventos: **void con auditoría**
- Inserta solo valores `> 0`
- Usa **mediodía local (America/Monterrey)** como timestamp canónico del día

Esto elimina:
- Errores de FK
- Drift entre UI, scoring y DB
- Inconsistencias por mayúsculas o espacios

---

## 7. MOTOR DE EVENTOS (NÚCLEO DEL SISTEMA)

Entidad central: `activity_events`

Campos clave:
- `actor_user_id`
- `metric_key` (FK a `metric_definitions`)
- `value`
- `recorded_at` (fuente de verdad temporal)
- `happened_at` (informativo)
- `source`
- `idempotency_key`
- `metadata`

Reglas:
- Los eventos **no se editan**
- Se void con auditoría
- Idempotencia obligatoria
- Todo el sistema se recalcula **a partir de eventos**

---

## 8. PIPELINE V0 (INTEGRADO)

- CRUD de leads
- Kanban drag & drop
- Auditoría completa (`lead_stage_history`)
- RPC `move_lead_stage`
- Auto-log en `activity_events`
- Alimenta OKR y racha
- Idempotencia por buckets de tiempo

---

## 9. ARQUITECTURA DE DASHBOARDS

### 9.1 Hook central compartido
`src/modules/okr/dashboard/useTeamOkrDashboard.ts`

Características:
- Reutiliza los mismos cálculos OKR
- No toca RLS
- No usa JWT
- Maneja loading, errores y race conditions

### Scope automático por rol
- **Owner**
  - Ve todos los advisors
  - Puede filtrar por manager/recruiter
- **Manager**
  - Solo advisors con `profiles.manager_user_id = auth.uid()`

---

## 10. DETALLE SEMANAL DEL ASESOR

Ruta:

Características:
- Read-only
- Accesible para Owner y Manager
- Usa los mismos cálculos
- Sin lógica duplicada

Bloques:
1. Resumen semanal
2. Insights accionables
3. Desglose por métrica
4. Línea de tiempo (Lunes–Domingo)
5. Plan para cumplir

---

## 11. MANEJO DE FECHAS Y TIMEZONE

Reglas cerradas:
- Lógica usa strings `YYYY-MM-DD`
- Comparaciones no dependen del timezone del navegador
- Render con `Date.UTC`
- Conversión con helpers usando `America/Monterrey`

Esto evita bugs por DST y desfases frontend/DB.

---

## 12. MIGRACIONES Y CONSISTENCIA DE ESQUEMA

- Migraciones SQL son la **única fuente de cambio estructural**
- Local y Cloud deben estar **siempre sincronizados**
- Drift se corrige con migraciones idempotentes, nunca manualmente

Migraciones clave:
- `seed_metric_definitions_okr`
- `repair_metric_definitions_okr_seed` (hotfix histórico)
- `harden_upsert_daily_metrics_*`

---

## 13. PRINCIPIOS RECTORES

- El sistema guía, no castiga
- La constancia importa más que el resultado aislado
- La UI interpreta, no decide
- Evitar duplicación de lógica
- Centralizar helpers
- Preferir claridad sobre complejidad

---

## 14. REGLA DE DESARROLLO (NO NEGOCIABLE)

> Si algo no se usaría mañana por un asesor o manager, **no se construye hoy**.

---

## 15. USO DE ESTE DOCUMENTO

- Fuente única de verdad del proyecto
- No es bitácora de prompts
- Toda decisión estructural **debe quedar aquí antes de escribir código**

---



FIN DEL PROJECT_CONTEXT — VANT
