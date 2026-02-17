/**
 * Re-export del cliente supabase singleton desde supabaseClient
 * Esto asegura que toda la app usa el mismo cliente (resistente a Vite HMR)
 */
export { supabase } from './supabaseClient'
