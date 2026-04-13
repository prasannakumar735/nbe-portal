import { Resend } from 'resend'

type Params = {
  to: string
  clientName: string
  companyName: string
  loginUrl: string
  email: string
  password: string
}

/**
 * Sends portal credentials when RESEND_API_KEY is configured. Returns whether an email was sent.
 */
export async function sendClientCredentialsEmail(params: Params): Promise<{ sent: boolean; error?: string }> {
  const key = (process.env.RESEND_API_KEY ?? '').trim()
  if (!key) {
    return { sent: false }
  }

  const from = (process.env.SYSTEM_EMAIL ?? 'noreply@nbeaustralia.com.au').trim()
  const resend = new Resend(key)

  const subject = 'Your NBE client portal access'
  const html = `
    <p>Hello ${escapeHtml(params.clientName)},</p>
    <p>Your organisation (${escapeHtml(params.companyName || 'NBE client')}) can sign in to the client report portal using:</p>
    <ul>
      <li><strong>Portal:</strong> <a href="${escapeHtml(params.loginUrl)}">${escapeHtml(params.loginUrl)}</a></li>
      <li><strong>Email:</strong> ${escapeHtml(params.email)}</li>
      <li><strong>Temporary password:</strong> ${escapeHtml(params.password)}</li>
    </ul>
    <p>Please change your password after you first sign in.</p>
    <p>If you did not expect this message, contact NBE.</p>
  `

  try {
    await resend.emails.send({
      from,
      to: [params.to],
      subject,
      html,
    })
    return { sent: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Email send failed'
    return { sent: false, error: msg }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
