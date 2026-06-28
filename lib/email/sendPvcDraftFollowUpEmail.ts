import nodemailer from 'nodemailer'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getManagerPlusServiceRecipients } from '@/lib/notifications/managerRecipients'

export type PvcDraftFollowUpRow = {
  id: string
  customer_name: string | null
  created_at: string | null
}

export async function sendManagerDraftPvcFollowUpEmail(
  supabase: SupabaseClient,
  rows: PvcDraftFollowUpRow[],
): Promise<void> {
  if (rows.length === 0) return

  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || '587')
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM || user

  if (!host || !user || !pass || !from) {
    return
  }

  const recipients = await getManagerPlusServiceRecipients(supabase)
  if (recipients.length === 0) return

  const to = recipients.map(r => r.email).join(', ')

  const lines = rows.map(r => {
    const created = String(r.created_at ?? '').slice(0, 10)
    return `• ${r.customer_name || 'PVC quote'} (saved ${created}) — /pvc-calculator/${r.id}/edit`
  })

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  await transporter.sendMail({
    from,
    to,
    subject: 'PVC strip quotes — draft follow-up reminder',
    text: [
      'The following PVC strip quotes have been in Draft for at least 2 days:',
      '',
      ...lines,
      '',
      'Would you like to follow up with the client again, or move the quote to On hold while they decide?',
      '',
      'In the PVC Strip Calculator you can:',
      '  • Put on hold — client needs more time',
      '  • Approve — if the client has accepted',
      '  • Rejected / Closed — if they are not proceeding',
      '',
      'thanks',
      'nbe portal team',
    ].join('\n'),
  })
}
