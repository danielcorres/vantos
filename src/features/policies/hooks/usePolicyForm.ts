import { useCallback, useEffect, useState } from 'react'
import { policiesApi } from '../policies.api'
import { DEFAULT_INSURER, FORM_RAMOS, isFormRamo } from '../policies.constants'
import type { CreatePolicyInput, Policy } from '../policies.types'

function normalizeForSave(values: CreatePolicyInput): CreatePolicyInput {
  const ramo = isFormRamo(values.ramo) ? values.ramo : (FORM_RAMOS[0] as CreatePolicyInput['ramo'])
  return {
    ...values,
    insurer: DEFAULT_INSURER,
    ramo,
  }
}

const defaultValues = (): CreatePolicyInput => ({
  lead_id: null,
  contractor_name: '',
  insurer: DEFAULT_INSURER,
  policy_number: '',
  ramo: 'vida',
  product_name: '',
  start_date: '',
  end_date: '',
  issued_at: null,
  premium_amount: 0,
  currency: 'mxn',
  payment_frequency: 'annual',
  receipt_status: 'pending',
  campaign_source: null,
  is_countable: true,
})

function policyToForm(p: Policy): CreatePolicyInput {
  return {
    lead_id: p.lead_id,
    contractor_name: p.contractor_name,
    insurer: p.insurer,
    policy_number: p.policy_number,
    ramo: p.ramo,
    product_name: p.product_name,
    start_date: p.start_date,
    end_date: p.end_date,
    issued_at: p.issued_at,
    premium_amount: p.premium_amount,
    currency: p.currency,
    payment_frequency: p.payment_frequency,
    receipt_status: p.receipt_status,
    campaign_source: p.campaign_source,
    is_countable: p.is_countable,
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function parseYmd(s: string): { y: number; m: number; d: number } | null {
  if (!DATE_RE.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
  return { y, m, d }
}

export function validatePolicyForm(values: CreatePolicyInput): string | null {
  if (!values.contractor_name.trim()) return 'Indica el nombre del contratante.'
  if (!values.insurer.trim()) return 'Indica la aseguradora.'
  if (!values.policy_number.trim()) return 'Indica el número de póliza.'
  if (!values.product_name.trim()) return 'Indica el nombre del producto.'
  if (!values.start_date || !values.end_date) return 'Indica inicio y fin de vigencia.'
  const a = parseYmd(values.start_date)
  const b = parseYmd(values.end_date)
  if (!a || !b) return 'Las fechas deben tener formato AAAA-MM-DD.'
  if (values.start_date > values.end_date) return 'La fecha de inicio no puede ser posterior al fin de vigencia.'
  if (!(values.premium_amount > 0) || !Number.isFinite(values.premium_amount)) {
    return 'La prima debe ser un número mayor que cero.'
  }
  if (values.issued_at) {
    const i = parseYmd(values.issued_at)
    if (!i) return 'La fecha de emisión no es válida.'
  }
  return null
}

export interface UsePolicyFormResult {
  values: CreatePolicyInput
  setField: <K extends keyof CreatePolicyInput>(key: K, value: CreatePolicyInput[K]) => void
  submitting: boolean
  error: string | null
  submit: () => Promise<void>
  reset: () => void
}

export function usePolicyForm(options: {
  editingPolicy: Policy | null
  onSaved?: () => void
}): UsePolicyFormResult {
  const { editingPolicy, onSaved } = options
  const [values, setValues] = useState<CreatePolicyInput>(defaultValues)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (editingPolicy) {
      setValues(policyToForm(editingPolicy))
    } else {
      setValues(defaultValues())
    }
    setError(null)
  }, [editingPolicy])

  const setField = useCallback(<K extends keyof CreatePolicyInput>(key: K, value: CreatePolicyInput[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  const reset = useCallback(() => {
    setValues(editingPolicy ? policyToForm(editingPolicy) : defaultValues())
    setError(null)
  }, [editingPolicy])

  const submit = useCallback(async () => {
    const payload = normalizeForSave(values)
    const msg = validatePolicyForm(payload)
    if (msg) {
      setError(msg)
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      if (editingPolicy) {
        await policiesApi.update(editingPolicy.id, payload)
      } else {
        await policiesApi.create(payload)
      }
      onSaved?.()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSubmitting(false)
    }
  }, [values, editingPolicy, onSaved])

  return { values, setField, submitting, error, submit, reset }
}
