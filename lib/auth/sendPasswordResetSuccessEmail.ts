import { sendMailViaGraph } from '@/lib/graph/sendMail'

/**
 * Confirmation that a portal password was changed (after reset or recovery flow).
 * Failures are logged by callers; do not block the password change on email errors.
 */
export async function sendPasswordResetSuccessEmail(to: string): Promise<void> {
  const address = to.trim()
  if (!address || !address.includes('@')) {
    throw new Error('Invalid recipient for password reset confirmation email.')
  }

  const html = [
    `Hi,<br/><br/>`,
    `Your NBE Portal password was reset successfully.<br/><br/>`,
    `If you did not make this change, contact your administrator immediately.<br/><br/>`,
    `— NBE Team`,
  ].join('')

  await sendMailViaGraph({
    to: address,
    subject: 'NBE Portal — password reset confirmation',
    bodyHtml: html,
  })
}
