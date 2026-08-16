import { sendMailViaGraphWithResult } from '@/lib/graph/sendMail'
import { looksLikeHtml } from '@/lib/sales/sending/emailBodyFormat'
import type { SendEmailInput, SendEmailResult } from '@/lib/sales/sending/emailSenderAdapter.types'

/** Send a single outbound sales email via Microsoft 365 (Graph sendMail). */
export async function sendOutboundEmailViaMicrosoft365(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const body = input.body.trim()
  const graphAttachments =
    input.attachments?.map((att) => ({
      name: att.fileName,
      contentType: att.contentType,
      contentBytes: att.contentBytes,
      isInline: att.isInline,
      contentId: att.contentId,
    })) ?? []

  const result = await sendMailViaGraphWithResult({
    to: input.recipient,
    subject: input.subject,
    bodyHtml: looksLikeHtml(body) ? body : undefined,
    bodyText: looksLikeHtml(body) ? undefined : body,
    attachments: graphAttachments.length > 0 ? graphAttachments : undefined,
    listUnsubscribeUrl: input.unsubscribeUrl,
    timeoutMs:
      graphAttachments.length > 0
        ? Number(process.env.SALES_EMAIL_SEND_GRAPH_ATTACHMENTS_TIMEOUT_MS ?? 60_000)
        : undefined,
  })

  return {
    externalMessageId: result.correlationId,
    latencyMs: result.latencyMs,
    provider: 'microsoft365',
    httpStatus: result.httpStatus,
  }
}
