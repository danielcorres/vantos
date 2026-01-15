# ARCHITECTURE — Vant (Guía mínima de implementación)

Este documento describe la arquitectura mínima para implementar Vant de forma consistente, segura y mantenible, evitando “suposiciones” típicas de desarrollo asistido por IA.

---

## 1. Resumen de arquitectura

Vant es un sistema interno para una sola agencia. Su núcleo es un **motor de eventos** que alimenta módulos operativos (OKR, pipeline, clientes, pólizas, etc.).

### Capas

1) **UI (React)**
- Pantallas simples y rápidas
- “Quick add” para registrar actividad
- Vistas por periodos (hoy, semana)

2) **API/Lógica**
- Preferentemente en DB (constraints, views, RPCs solo si aporta)
- Reglas de puntos y streaks calculables de forma determinista

3) **DB (Supabase/Postgres)**
- Fuente única de verdad
- RLS activado
- Migraciones versionadas

---

## 2. Principios de datos

### 2.1 Fuente de verdad
- Eventos = hechos
- Reglas = configuración versionada por vigencia
- Resultados (puntos, streaks, totales) = derivables / recalculables

### 2.2 Determinismo
Cualquier cálculo de puntos, rachas o metas debe poder reproducirse:
- (eventos + reglas + timezone) ⇒ resultados

### 2.3 Idempotencia y dedupe
- `idempotency_key` para eventos no-manuales (pipeline/system)
- Evitar doble conteo y “recalcular sumando lo anterior”

---

## 3. Modelo de dominio (mínimo)

### 3.1 Identidad y acceso

**users** (Supabase Auth)  
**profiles**
- user_id (PK/FK auth.users)
- role (owner/admin/advisor/staff/viewer)
- display_name
- created_at

> Nota: Una sola agencia. No hace falta un sistema complejo de organizaciones.

---

### 3.2 Motor de eventos (mínimo viable)

**metric_definitions**
- key (PK, text) e.g. `calls`
- label
- unit (optional)
- is_active (bool)
- sort_order (int)
- created_at

**point_rules**
- id (uuid)
- metric_key (FK metric_definitions.key)
- points (int)
- effective_from (date)
- effective_to (date, nullable)
- created_at

**activity_events**
- id (uuid)
- actor_user_id (FK profiles.user_id)
- metric_key (FK metric_definitions.key)
- value (int default 1)
- happened_at (timestamptz) — momento real del evento
- recorded_at (timestamptz default now())
- source (text: manual/pipeline/system)
- idempotency_key (text, nullable)
- metadata (jsonb, nullable)
- is_void (bool default false) — para correcciones sin borrar historia

Índices sugeridos:
- (actor_user_id, happened_at desc)
- (metric_key, happened_at desc)
- unique(idempotency_key) where idempotency_key is not null

---

### 3.3 Metas y periodos

**targets**
- id (uuid)
- user_id (FK profiles.user_id)
- metric_key (FK metric_definitions.key)
- period_type (text: weekly/monthly)
- period_start (date)
- target_value (int)
- created_at

---

### 3.4 Auditoría (mínimo)

**audit_log**
- id (uuid)
- actor_user_id (FK profiles.user_id)
- action (text) e.g. `UPDATE_POINT_RULE`
- entity (text) e.g. `point_rules`
- entity_id (text/uuid)
- before (jsonb)
- after (jsonb)
- created_at

---

## 4. Reglas críticas (para evitar bugs típicos)

### 4.1 Reglas de “día” y semana
- Toda agregación diaria/semanal se calcula en timezone **America/Monterrey**
- Definir “semana” (ISO o lunes-domingo) y mantenerlo fijo

### 4.2 Correcciones de eventos
- No editar eventos históricos que ya afectan puntos
- Usar:
  - `is_void=true` (anulación)
  - y/o evento de corrección con metadata referencing original_event_id

### 4.3 Recalcular sin sumar doble
- Nunca acumular “sobre totales guardados” si esos totales se derivan de eventos.
- Cálculos se basan en consultas agregadas sobre `activity_events` filtrando `is_void=false`.

---

## 5. RLS (Row Level Security) — reglas mínimas

Objetivo: evitar que IA deje datos expuestos o con permisos mal diseñados.

### 5.1 Principio
- Para tablas de negocio: RLS ON
- Políticas simples al inicio:
  - advisors: solo ven sus eventos/targets
  - admin/owner: pueden ver todos

Ejemplo conceptual:
- `activity_events`: allow select where actor_user_id = auth.uid() OR role in (admin, owner)
- `targets`: allow select where user_id = auth.uid() OR role in (admin, owner)

---

## 6. UI: pantallas mínimas (OKR v0)

### 6.1 “Hoy”
- Lista de métricas con botones rápidos (+1)
- Confirmación inmediata
- “Undo” del último evento

### 6.2 “Semana”
- Totales por métrica
- Puntos por día
- Estado de racha

---

## 7. Convenciones de proyecto (para evitar caos)

- Todo cambio de DB va por migración
- Nombres consistentes: `snake_case` en DB, `camelCase` en TS
- Carpetas por dominio:
  - `src/modules/okr`
  - `src/modules/pipeline`
  - `src/shared`
  - `src/lib/supabase`

---

## 8. Checklist antes de construir features nuevas

Antes de agregar una feature, verificar:
- ¿Crea eventos? ¿Define idempotency/dedupe?
- ¿Tiene edge cases definidos?
- ¿Qué pasa si se registra con fecha pasada?
- ¿Cómo se corrige sin romper historia?
- ¿Qué política RLS aplica?
- ¿Qué prueba mínima lo valida?

---

Fin de ARCHITECTURE.md
