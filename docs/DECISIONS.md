# DECISIONS — Vant (Bitácora de decisiones)

Este archivo es una **bitácora corta** (changelog) de decisiones del proyecto.

Reglas:
- Aquí sí se registran decisiones conforme ocurren (con fecha).
- Debe ser breve: 3–10 bullets por día como máximo.
- No pegues prompts ni respuestas completas de IA.
- Si una decisión cambia el rumbo del sistema, también debe reflejarse en `PROJECT_CONTEXT.md`.

Formato recomendado:
## YYYY-MM-DD
- Decisión:
- Motivo:
- Impacto:
- Pendientes:

---

## 2026-01-07
- Se reinició el proyecto: nada se considera desarrollado.
- Se definió que el sistema opera para una sola agencia (sin onboarding de múltiples organizaciones).
- Se estableció el orden obligatorio de módulos iniciando con OKR v0.
- Se robusteció el núcleo del sistema alrededor de un motor de eventos (idempotencia, dedupe, timezone).


## 2026-01-07
- Se completó OKR v0 en local: login + Hoy + Semana.
- Se implementaron RPCs: log_activity_event y void_last_event_today.
- Se implementaron Views: okr_today_summary, okr_week_metric_totals, okr_week_daily_summary.
- Undo definido como “último registro del día” para mantener UX simple y evitar manipulación histórica.

