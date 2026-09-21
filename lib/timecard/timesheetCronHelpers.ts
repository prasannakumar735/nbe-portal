import type { SupabaseClient } from '@supabase/supabase-js'
import { profileDisplayName, type ProfileFromTable } from '@/lib/auth/roles'
import { isValidEmail } from '@/lib/notifications/managerRecipients'

export const TIMESHEET_ELIGIBLE_ROLES = ['technician', 'employee', 'manager', 'admin'] as const

export type EligibleProfile = {
  id: string
  full_name: string | null
  first_name: string | null
  last_name: string | null
  role: string | null
}

export async function loadEligibleTimesheetProfiles(
  supabase: SupabaseClient,
): Promise<EligibleProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, first_name, last_name, role')
    .in('role', [...TIMESHEET_ELIGIBLE_ROLES])
  if (error) throw new Error(error.message)
  return (data ?? []) as EligibleProfile[]
}

export async function resolveAuthEmail(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('notification_email')
    .eq('id', userId)
    .maybeSingle()

  if (profile?.notification_email) {
    const notifEmail = String(profile.notification_email).trim()
    if (isValidEmail(notifEmail)) return notifEmail
  }

  const { data, error } = await supabase.auth.admin.getUserById(userId)
  if (error || !data.user?.email) return null
  const em = String(data.user.email).trim()
  return isValidEmail(em) ? em : null
}

export function displayNameFromProfile(
  profile: ProfileFromTable | EligibleProfile,
  fallbackEmail?: string | null,
): string {
  const name = profileDisplayName(profile)
  if (name) return name
  if (fallbackEmail) return fallbackEmail.split('@')[0] ?? 'Employee'
  return 'Employee'
}

export type TimesheetCronRow = {
  id: string
  user_id: string
  week_start_date: string
  week_end_date: string
  total_hours: unknown
  status: string
  reminder_1_sent_at: string | null
  reminder_2_sent_at: string | null
  auto_submitted_at: string | null
}

export function sheetIsPending(status: unknown): boolean {
  const s = String(status ?? '')
  return s === 'draft' || s === 'rejected'
}
