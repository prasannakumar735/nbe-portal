import type { SupabaseClient } from '@supabase/supabase-js'

/** Matches maintenance workflow: service inbox + all manager/admin Auth emails. */
export const SERVICE_NOTIFY_EMAIL = 'service@nbeaustralia.com.au'

export function isValidEmail(value: string): boolean {
  const v = value.trim()
  return v.includes('@') && v.length > 3 && !v.includes(' ')
}

/**
 * Resolves manager/admin profiles to Auth emails and appends service@ (deduped).
 */
export async function getManagerPlusServiceRecipients(
  supabase: SupabaseClient,
): Promise<Array<{ email: string; full_name: string | null }>> {
  const { data: managers, error: mgrErr } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('role', ['manager', 'admin'])

  if (mgrErr) {
    throw new Error(mgrErr.message)
  }

  const profileRows = managers ?? []
  const emailByUserId = new Map<string, string>()
  await Promise.all(
    profileRows.map(async row => {
      const id = String((row as { id?: string }).id ?? '').trim()
      if (!id) return
      const { data, error } = await supabase.auth.admin.getUserById(id)
      if (error || !data.user?.email) return
      const em = String(data.user.email).trim()
      if (isValidEmail(em)) emailByUserId.set(id, em)
    }),
  )

  const seen = new Set<string>()
  const recipients: Array<{ email: string; full_name: string | null }> = []
  for (const m of profileRows) {
    const id = String((m as { id?: string }).id ?? '').trim()
    const email = emailByUserId.get(id)
    if (!email) continue
    const key = email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    recipients.push({
      email,
      full_name: String((m as { full_name?: string | null }).full_name ?? '').trim() || null,
    })
  }

  const serviceEmail = SERVICE_NOTIFY_EMAIL.trim().toLowerCase()
  if (isValidEmail(SERVICE_NOTIFY_EMAIL) && !seen.has(serviceEmail)) {
    seen.add(serviceEmail)
    recipients.push({
      email: SERVICE_NOTIFY_EMAIL.trim(),
      full_name: 'Team',
    })
  }

  return recipients
}
