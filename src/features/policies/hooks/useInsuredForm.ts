import { useCallback, useEffect, useState } from 'react'
import { policyInsuredApi } from '../policyInsured.api'
import type { PolicyInsured, Relationship } from '../policies.insured.types'

export type InsuredDraft = {
  full_name: string
  relationship: Relationship
  birth_date: string | null
  phone: string | null
  email: string | null
  notes: string | null
}

function emptyDraft(): InsuredDraft {
  return {
    full_name: '',
    relationship: 'titular',
    birth_date: null,
    phone: null,
    email: null,
    notes: null,
  }
}

function insuredToDraft(p: PolicyInsured): InsuredDraft {
  return {
    full_name: p.full_name,
    relationship: p.relationship,
    birth_date: p.birth_date,
    phone: p.phone,
    email: p.email,
    notes: p.notes,
  }
}

export function validateInsuredDraft(d: InsuredDraft): string | null {
  if (!d.full_name.trim()) return 'Indica el nombre completo del asegurado.'
  return null
}

export function useInsuredForm(options: {
  policyId: string
  editing: PolicyInsured | null
  onSaved?: () => void
}) {
  const { policyId, editing, onSaved } = options
  const [values, setValues] = useState<InsuredDraft>(emptyDraft())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (editing) {
      setValues(insuredToDraft(editing))
    } else {
      setValues(emptyDraft())
    }
    setError(null)
  }, [editing])

  const setField = useCallback(<K extends keyof InsuredDraft>(key: K, value: InsuredDraft[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  const reset = useCallback(() => {
    setValues(editing ? insuredToDraft(editing) : emptyDraft())
    setError(null)
  }, [editing])

  const submit = useCallback(async () => {
    const msg = validateInsuredDraft(values)
    if (msg) {
      setError(msg)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      if (editing) {
        await policyInsuredApi.update(editing.id, {
          full_name: values.full_name.trim(),
          relationship: values.relationship,
          birth_date: values.birth_date || null,
          phone: values.phone?.trim() || null,
          email: values.email?.trim() || null,
          notes: values.notes?.trim() || null,
        })
      } else {
        await policyInsuredApi.create({
          policy_id: policyId,
          full_name: values.full_name.trim(),
          relationship: values.relationship,
          birth_date: values.birth_date || null,
          phone: values.phone?.trim() || null,
          email: values.email?.trim() || null,
          notes: values.notes?.trim() || null,
          client_number: null,
        })
      }
      onSaved?.()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }, [values, editing, policyId, onSaved])

  return { values, setField, submitting, error, submit, reset }
}
