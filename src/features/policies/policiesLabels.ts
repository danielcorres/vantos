import type { Currency, PaymentFrequency, Ramo, ReceiptStatus } from './policies.types'

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
  annual: 'Anual',
  semiannual: 'Semestral',
  quarterly: 'Trimestral',
  monthly: 'Mensual',
}

export const RECEIPT_LABELS: Record<ReceiptStatus, string> = {
  paid: 'Pagado',
  pending: 'Pendiente',
  overdue: 'Vencido',
}
