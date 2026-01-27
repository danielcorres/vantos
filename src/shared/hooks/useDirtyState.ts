import { useMemo } from 'react'

/**
 * Comparación estable de campos para saber si hay cambios (dirty).
 * Evita JSON.stringify para no generar churn por orden de keys o referencias.
 * @param original Objeto de referencia (ej. lead guardado)
 * @param current Objeto actual (ej. estado del formulario)
 * @param keys Keys a comparar; si no se pasan, se usan las de current
 */
export function useDirtyState<T extends Record<string, unknown>>(
  original: T | null | undefined,
  current: T | null | undefined,
  keys?: (keyof T)[]
): boolean {
  return useMemo(() => {
    if (original == null && current == null) return false
    if (original == null || current == null) return true
    const k = (keys ?? Object.keys(current)) as (keyof T)[]
    for (const key of k) {
      if (original[key] !== current[key]) return true
    }
    return false
  }, [original, current, keys])
}
