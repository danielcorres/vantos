import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_SINGLETON_KEY = '__vant_supabase__'

// Singleton resistente a Vite HMR
function getSupabaseClient(): SupabaseClient {
  // Verificar si ya existe en globalThis
  if ((globalThis as any)[SUPABASE_SINGLETON_KEY]) {
    return (globalThis as any)[SUPABASE_SINGLETON_KEY]
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  }

  // Crear cliente una sola vez
  const client = createClient(supabaseUrl, supabaseAnonKey)
  
  // Guardar en globalThis para persistir entre HMR
  ;(globalThis as any)[SUPABASE_SINGLETON_KEY] = client

  return client
}

export const supabase = getSupabaseClient()
