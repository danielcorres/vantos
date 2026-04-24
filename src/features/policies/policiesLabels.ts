import type { Currency, PaymentFrequency, Ramo, ReceiptStatus } from './policies.types'
import type { Relationship } from './policies.insured.types'

export const RAMO_LABELS: Record<Ramo, string> = {
  vida: 'Vida',
  gmm: 'GMM',
  daños: 'Daños',
  auto: 'Auto',
  rc: 'RC',
}

export const CURRENCY_LABELS: Record<Currency, string> = {
  mxn: 'MXN',
  usd: 'USD',
  udi: 'UDI',
}

export const FREQUENCY_LABELS: Record<PaymentFrequency, string> = {
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
}

export const RECEIPT_LABELS: Record<ReceiptStatus, string> = {
  paid: 'Pagado',
  pending: 'Pendiente',
  overdue: 'Vencido',
}

export const RELATIONSHIP_LABELS: Record<Relationship, string> = {
  titular: 'Titular',
  spouse: 'Cónyuge',
  child: 'Hijo/a',
  parent: 'Padre/Madre',
  other: 'Otro',
}
