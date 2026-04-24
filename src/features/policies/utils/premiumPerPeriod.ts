import type { PaymentFrequency } from '../policies.types'

const PAYMENTS_PER_YEAR: Record<PaymentFrequency, number> = {
  monthly: 12,
  quarterly: 4,
  semiannual: 2,
  annual: 1,
}

export function premiumPerPeriod(amount: number, freq: PaymentFrequency): number {
  const n = PAYMENTS_PER_YEAR[freq]
  if (!n || n <= 0) return amount
  return amount / n
}
