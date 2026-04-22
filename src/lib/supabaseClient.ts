import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_SINGLETON_KEY = '__vant_supabase__'

type GlobalSupabaseStore = typeof globalThis & Record<string, SupabaseClient | undefined>

function readCachedClient(): SupabaseClient | undefined {
  const g = globalThis as GlobalSupabaseStore
  return g[SUPABASE_SINGLETON_KEY]
}

function writeCachedClient(client: SupabaseClient): void {
  const g = globalThis as GlobalSupabaseStore
  g[SUPABASE_SINGLETON_KEY] = client
}

// Singleton resistente a Vite HMR
function getSupabaseClient(): SupabaseClient {
  const cached = readCachedClient()
  if (cached) return cached

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  }

  const client = createClient(supabaseUrl, supabaseAnonKey)
  writeCachedClient(client)
  return client
}

export const supabase = getSupabaseClient()
