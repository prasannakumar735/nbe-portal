import { sendMailViaGraphWithResult } from '@/lib/graph/sendMail'
import type { SendEmailInput, SendEmailResult } from '@/lib/sales/sending/emailSenderAdapter.types'

function looksLikeHtml(body: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(body)
}

/** Send a single outbound sales email via Microsoft 365 (Graph sendMail). */
export async function sendOutboundEmailViaMicrosoft365(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const body = input.body.trim()
  const result = await sendMailViaGraphWithResult({
    to: input.recipient,
    subject: input.subject,
    bodyHtml: looksLikeHtml(body) ? body : undefined,
    bodyText: looksLikeHtml(body) ? undefined : body,
  })

  return {
    externalMessageId: result.correlationId,
    latencyMs: result.latencyMs,
    provider: 'microsoft365',
    httpStatus: result.httpStatus,
  }
}
