// TODO: Implementar funciones de autenticación
import { supabase } from './supabaseClient'

export async function signInWithEmail(email: string) {
  // TODO: Implementar login con magic link
  return supabase.auth.signInWithOtp({ email })
}

export async function signOut() {
  // TODO: Implementar logout
  return supabase.auth.signOut()
}
