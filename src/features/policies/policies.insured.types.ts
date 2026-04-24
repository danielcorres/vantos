export const RELATIONSHIPS = ['titular', 'spouse', 'child', 'parent', 'other'] as const
export type Relationship = (typeof RELATIONSHIPS)[number]

export type PolicyInsured = {
  id: string
  policy_id: string
  owner_user_id: string
  full_name: string
  relationship: Relationship
  birth_date: string | null
  phone: string | null
  email: string | null
  notes: string | null
  client_number: string | null
  created_at: string
  updated_at: string
}

export type CreateInsuredInput = Omit<PolicyInsured, 'id' | 'owner_user_id' | 'created_at' | 'updated_at'>

export type UpdateInsuredInput = Partial<Omit<CreateInsuredInput, 'policy_id'>>
