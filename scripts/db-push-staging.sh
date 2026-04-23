#!/usr/bin/env bash
# Carga SUPABASE_DB_PASSWORD desde .env.staging (no versionar), enlaza staging y aplica migraciones.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="${ROOT}/.env.staging"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Falta ${ENV_FILE}" >&2
  echo "Copia .env.staging.example -> .env.staging y pon SUPABASE_DB_PASSWORD=..." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  echo "SUPABASE_DB_PASSWORD está vacío en .env.staging" >&2
  exit 1
fi

supabase link --project-ref cayibyaingcvhzwhfrhy
supabase db push --include-all "$@"
