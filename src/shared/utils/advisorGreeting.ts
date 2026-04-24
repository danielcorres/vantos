import type { Profile } from '../../lib/profile'
import { TZ_MTY } from './dates'

/** Primer nombre o apodo para saludos informales. */
export function deriveWelcomeName(profile: Profile | null, emailFallback?: string | null): string {
  const first = profile?.first_name?.trim()
  if (first) return first
  const full = profile?.full_name?.trim()
  if (full) {
    const part = full.split(/\s+/)[0]
    return part || full
  }
  const disp = profile?.display_name?.trim()
  if (disp) {
    const part = disp.split(/\s+/)[0]
    return part || disp
  }
  if (emailFallback) {
    const local = emailFallback.split('@')[0]?.trim()
    if (local) return local
  }
  return 'allí'
}

export function isBirthdayToday(birthDate: string | null | undefined, todayYmd: string): boolean {
  if (!birthDate || birthDate.length < 10) return false
  return birthDate.slice(5, 10) === todayYmd.slice(5, 10)
}

/** Edad cumplida hoy (solo válido si `isBirthdayToday` es true). */
export function completedAgeOnBirthday(birthYmd: string, todayYmd: string): number {
  if (birthYmd.length < 10 || todayYmd.length < 10) return 0
  const by = Number(birthYmd.slice(0, 4))
  const bm = Number(birthYmd.slice(5, 7))
  const bd = Number(birthYmd.slice(8, 10))
  const ty = Number(todayYmd.slice(0, 4))
  const tm = Number(todayYmd.slice(5, 7))
  const td = Number(todayYmd.slice(8, 10))
  if (![by, bm, bd, ty, tm, td].every((n) => Number.isFinite(n))) return 0
  let age = ty - by
  if (tm < bm || (tm === bm && td < bd)) age -= 1
  return Math.max(0, age)
}

/** Nombre para mensaje de cumpleaños (nombre completo si existe). */
export function advisorFormalNameForBirthday(profile: Profile | null, welcomeFirst: string): string {
  const full = profile?.full_name?.trim()
  if (full) return full
  const disp = profile?.display_name?.trim()
  if (disp) return disp
  return welcomeFirst
}

export function timeOfDayGreetingMonterrey(): 'Buenos días' | 'Buenas tardes' | 'Buenas noches' {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ_MTY,
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '12')
  if (hour >= 5 && hour < 12) return 'Buenos días'
  if (hour >= 12 && hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}
