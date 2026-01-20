# PROJECT_CONTEXT — VANT (Sistema Interno)

---

## 1. PROPÓSITO DEL PROYECTO

VANT es un sistema operativo interno para **una sola agencia de seguros** (NO SaaS).

Objetivos principales:
- Acompañar la ejecución diaria del asesor
- Medir **actividad real**, no solo resultados finales
- Dar visibilidad **operativa y accionable** a líderes
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
  - relaciones explícitas (`manager_user_id`, `recruiter_user_id`)
- Supabase es el backend único:
  - Base de datos
  - Auth
  - RLS
  - RPCs
  - Migraciones

---

## 3. ESTADO ACTUAL DEL PROYECTO (ENERO 2026)

**OKR v0 + Pipeline + Dashboards operativos funcionan end-to-end en Local y Cloud.**

### Completado y validado
- Supabase local y Supabase Cloud sincronizados
- Historial de migraciones consistente (sin drift)
- RLS activo y validado en todas las tablas de negocio
- RPCs críticos endurecidos
- OKR Diario y Semanal
- Pipeline v0 integrado a OKR
- Dashboards Owner y Manager
- Detalle semanal por asesor (read-only)
- Catálogo maestro de métricas OKR
- FK y validaciones activas
- Manejo de fechas y timezone validado
- **Modelo de Roles y Asignaciones cerrado y operativo**

### Pendiente / siguiente fase
- Pulido visual y micro-interacciones
- Comparativo semana vs semana anterior
- Insights clicables (dashboard → acción)
- Gamificación ligera
- Uso real con usuarios y ajustes de flujo
- Vistas “sin financieros” para rol Seguimiento

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

## 5. MODELO DE ROLES Y ASIGNACIONES (DECISIÓN CERRADA)

### 5.1 Roles del sistema

| Rol | Descripción |
|---|---|
| `owner` | Creador del sistema. Ve y configura todo. Existe **un solo owner real**. |
| `director` | Ve toda la información (incluye financieros). **Puede asignar roles**, pero no configura reglas core. |
| `manager` | Da seguimiento a asesores asignados. |
| `recruiter` | Responsable del origen de asesores. |
| `advisor` | Rol operativo base (**default**). |
| `seguimiento` | Equipo operativo que **ve todo lo no financiero**. No asigna ni configura. |

---

### 5.2 Fuente de verdad del Owner

- El **owner real del sistema** se define exclusivamente en:
  - `okr_settings_global.owner_user_id`
- El campo `profiles.role = 'owner'` es **informativo**, no autoritativo.
- La UI **no permite asignar el rol owner** manualmente.

---

### 5.3 Asignaciones permitidas

Solo `owner` y `director` pueden:
- cambiar `profiles.role`
- asignar `profiles.manager_user_id`
- asignar `profiles.recruiter_user_id`

Regla estructural:
- `manager_user_id` y `recruiter_user_id` **solo aplican si** `role = 'advisor'`
- Para cualquier otro rol:
  - ambos campos deben ser `NULL`

---

### 5.4 Enforcements a nivel DB (RLS + Triggers)

Funciones clave:
- `can_assign_roles()` → `is_owner() OR is_director()`
- `is_director()`
- `is_seguimiento()`

Triggers:
- `trg_profiles_block_sensitive_updates`  
  Bloquea cambios de role/manager/recruiter si no `can_assign_roles()`
- `trg_profiles_normalize_assignments`  
  Limpia `manager_user_id` y `recruiter_user_id` si `role != advisor`
- `trg_profiles_default_role_advisor`  
  Todo profile nuevo entra como `advisor` si no se especifica rol

Policies RLS en `profiles`:

**SELECT**
- Owner: ve todos
- Director: ve todos
- Seguimiento: ve todos (no financiero)
- Manager: solo advisors asignados
- Recruiter: solo advisors reclutados
- Self: cada usuario ve su perfil

**UPDATE**
- Self: puede actualizar su perfil (sin cambios sensibles)
- Owner/Director: pueden actualizar cualquier perfil

---

### 5.5 UI — Módulo de Asignaciones (Owner)

Archivo principal:
- `src/pages/owner/AssignmentsPage.tsx`

Decisiones:
- Auto-guardado **real** (sin “falso guardado”)
- Cada update:
  - se hace por `user_id`
  - usa `.select().single()`
  - valida retorno (si no hay fila → error visible)
- El Owner del sistema se muestra **read-only**
- Roles editables en UI:
  - `advisor`, `manager`, `recruiter`, `director`, `seguimiento`
- `manager` y `recruiter` solo habilitados cuando `role = advisor`
- Acceso a la pantalla:
  - solo `owner` y `director`

---

## 6. DOMINIO OKR (DECISIONES CERRADAS)

### 6.1 Métricas OKR — Catálogo maestro

- `metric_definitions` es la **fuente única de verdad**
- `activity_events.metric_key` tiene FK obligatoria
- Ningún evento puede existir con métricas no registradas

Toda métrica nueva:
> debe sembrarse primero por migración en `metric_definitions`

---

### 6.2 Labels UI

- Fuente canónica:
  - `src/modules/okr/domain/metricLabels.ts`
- UI **no define métricas**
- Solo consume labels

---

### 6.3 Puntos y metas

- `okr_metric_scores_global`
- `daily_base_target`
- `weekly_days`

Cálculos centralizados:
- `computeAdvisorWeekStats`
- `computeAdvisorHistoryStats`

---

## 7. RPC CRÍTICO — `upsert_daily_metrics`

Garantías:
- Normaliza metric keys
- Valida contra `metric_definitions`
- Respeta RLS
- Usa `auth.uid()`
- No edita eventos
- Usa timestamp canónico (America/Monterrey)

---

## 8. MOTOR DE EVENTOS (NÚCLEO)

Entidad central: `activity_events`

- Fuente única de verdad
- Eventos inmutables
- Void con auditoría
- Idempotencia obligatoria
- Todo se recalcula desde eventos

---

## 9. PIPELINE V0 (INTEGRADO)

- Kanban drag & drop
- Auditoría completa
- Auto-log a `activity_events`
- Alimenta OKR y rachas
- Idempotencia garantizada

---

## 10. DASHBOARDS

Hook central:
- `useTeamOkrDashboard.ts`

Scope:
- Owner: todos
- Manager: su equipo

Sin lógica duplicada.

---

## 11. FECHAS Y TIMEZONE

- Strings `YYYY-MM-DD`
- `Date.UTC`
- Helpers con `America/Monterrey`
- Sin dependencia del timezone del navegador

---

## 12. MIGRACIONES Y CONSISTENCIA

- Migraciones SQL = única fuente de cambio estructural
- Nada manual en Cloud
- Seeds **idempotentes**
- Sin UUIDs fijos para owner

---

## 13. PRINCIPIOS RECTORES

- El sistema guía, no castiga
- La constancia importa más que el resultado aislado
- La UI interpreta, no decide
- Evitar duplicación
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

**FIN — PROJECT_CONTEXT VANT**
