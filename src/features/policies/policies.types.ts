export const RAMOS = ['vida', 'gmm', 'daños', 'auto', 'rc'] as const
export type Ramo = (typeof RAMOS)[number]

export const CURRENCIES = ['mxn', 'usd', 'udi'] as const
export type Currency = (typeof CURRENCIES)[number]

export const PAYMENT_FREQUENCIES = ['monthly', 'quarterly', 'semiannual', 'annual'] as const
export type PaymentFrequency = (typeof PAYMENT_FREQUENCIES)[number]

export const RECEIPT_STATUSES = ['paid', 'pending', 'overdue'] as const
export type ReceiptStatus = (typeof RECEIPT_STATUSES)[number]

export type Policy = {
  id: string
  owner_user_id: string
  lead_id: string | null
  contractor_name: string
  insurer: string
  policy_number: string
  ramo: Ramo
  product_name: string
  start_date: string
  end_date: string
  issued_at: string | null
  contract_end_date: string | null
  premium_amount: number
  currency: Currency
  payment_frequency: PaymentFrequency
  receipt_status: ReceiptStatus
  campaign_source: string | null
  is_countable: boolean
  created_at: string
  updated_at: string
}

/** Payload para crear (owner_user_id lo asigna la API con la sesión). */
export type CreatePolicyInput = Omit<Policy, 'id' | 'owner_user_id' | 'created_at' | 'updated_at'>

export type UpdatePolicyInput = Partial<CreatePolicyInput>

export type PolicyFilters = {
  ramo?: Ramo
  insurer?: string
  receipt_status?: ReceiptStatus
  start_date_from?: string
  start_date_to?: string
}
