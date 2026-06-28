import nodemailer from 'nodemailer'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getManagerPlusServiceRecipients } from '@/lib/notifications/managerRecipients'

export async function sendManagerPendingPvcEmail(
  supabase: SupabaseClient,
  rows: { id: string; customer_name: string | null; approved_at: string | null }[],
): Promise<void> {
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

  const lines = rows.map(
    r =>
      `• ${r.customer_name || 'PVC quote'} (approved ${String(r.approved_at ?? '').slice(0, 10)}) — /pvc-calculator/${r.id}/edit`,
  )

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  await transporter.sendMail({
    from,
    to,
    subject: 'PVC strip quotes — pending shipped/installed action',
    text: [
      'The following PVC strip quotes are approved but not yet marked shipped or installed:',
      '',
      ...lines,
      '',
      'Please update the workflow in the PVC Strip Calculator.',
      '',
      'thanks',
      'nbe portal team',
    ].join('\n'),
  })
}
