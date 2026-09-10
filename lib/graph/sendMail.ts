/**
 * Send an email via Microsoft Graph API (sendMail).
 * Requires app permission Mail.Send or delegated Mail.Send, and a user to send as.
 */

export type GraphSendMailAttachment = {
  name: string
  contentType: string
  contentBytes: string
  isInline?: boolean
  contentId?: string
}

export type GraphSendMailOptions = {
  to: string
  /** Comma- or semicolon-separated CC addresses, or an array. */
  cc?: string | string[]
  subject: string
  /** Plain-text body (used when bodyHtml is not set). */
  bodyText?: string
  /** HTML body; takes precedence over bodyText when set. */
  bodyHtml?: string
  /** Optional; defaults to process.env.MS_GRAPH_MAIL_USER_ID or MS_ONEDRIVE_USER_ID */
  sendAsUserId?: string
  /** Correlation id for delivery logs (Graph sendMail returns no message id). */
  correlationId?: string
  /** Request timeout ms (default 30000). */
  timeoutMs?: number
  attachments?: GraphSendMailAttachment[]
  /**
   * Unsubscribe URL for the RFC 2369 List-Unsubscribe header.
   *
   * Graph rejects standard header names in `internetMessageHeaders` (they must
   * start with `x-`), so this is set via the MAPI named property PidTagListUnsubscribe
   * (`String 0x1045`) instead. Note this yields List-Unsubscribe only —
   * List-Unsubscribe-Post (RFC 8058 one-click) is not settable through Graph's
   * JSON sendMail and would require sending full MIME.
   */
  listUnsubscribeUrl?: string
}

export type GraphSendMailResult = {
  correlationId: string
  latencyMs: number
  httpStatus: number
}

import { getGraphAccessToken, resolveGraphMailboxUserId } from '@/lib/graph/graphAuth'

export function buildGraphFileAttachmentsPayload(
  attachments: GraphSendMailAttachment[],
): Record<string, unknown>[] {
  return attachments.map((att) => {
    const graphAtt: Record<string, unknown> = {
      '@odata.type': '#microsoft.graph.fileAttachment',
      name: att.name,
      contentType: att.contentType,
      contentBytes: att.contentBytes,
    }
    if (att.isInline) {
      graphAtt.isInline = true
      if (att.contentId) graphAtt.contentId = att.contentId
    }
    return graphAtt
  })
}

/**
 * Send an email using Microsoft Graph API.
 * Uses POST /users/{userId}/sendMail.
 */
export async function sendMailViaGraphWithResult(
  options: GraphSendMailOptions,
): Promise<GraphSendMailResult> {
  const {
    to,
    cc,
    subject,
    bodyText,
    bodyHtml,
    sendAsUserId,
    correlationId,
    timeoutMs,
    attachments,
    listUnsubscribeUrl,
  } = options

  const userId = resolveGraphMailboxUserId(sendAsUserId)

  const html = bodyHtml?.trim()
  const text = bodyText?.trim()
  if (!html && !text) {
    throw new Error('sendMailViaGraph requires bodyHtml or bodyText.')
  }

  const token = await getGraphAccessToken()
  const id =
    correlationId?.trim() ||
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `nbe-${Date.now()}`)

  const parseCcAddresses = (raw: string | string[] | undefined) => {
    if (!raw) return []
    const list = Array.isArray(raw) ? raw : raw.split(/[,;]/)
    return list.map(e => e.trim()).filter(e => e.includes('@')).map(e => ({ emailAddress: { address: e, name: e } }))
  }

  const toAddresses = to.split(/[,;]/).map(e => e.trim()).filter(e => e.includes('@')).map(e => ({ emailAddress: { address: e, name: e } }))
  const ccAddresses = parseCcAddresses(cc)

  const payload: Record<string, unknown> = {
    message: {
      subject,
      body: html
        ? { contentType: 'HTML', content: html }
        : { contentType: 'Text', content: text! },
      toRecipients: toAddresses,
      ...(ccAddresses.length > 0 ? { ccRecipients: ccAddresses } : {}),
      internetMessageHeaders: [
        {
          name: 'X-NBE-Correlation-Id',
          value: id.slice(0, 200),
        },
      ],
    },
    saveToSentItems: true,
  }

  if (attachments && attachments.length > 0) {
    const message = payload.message as Record<string, unknown>
    message.attachments = buildGraphFileAttachmentsPayload(attachments)
  }

  const unsubscribeUrl = listUnsubscribeUrl?.trim()
  if (unsubscribeUrl) {
    const message = payload.message as Record<string, unknown>
    message.singleValueExtendedProperties = [
      // PidTagListUnsubscribe (PtypString). RFC 2369 requires angle brackets.
      { id: 'String 0x1045', value: `<${unsubscribeUrl}>` },
    ]
  }

  const startedAt = Date.now()
  const defaultTimeout = Number(process.env.SALES_EMAIL_SEND_GRAPH_TIMEOUT_MS ?? 30_000)
  const timeout =
    timeoutMs ??
    (attachments && attachments.length > 0
      ? Number(process.env.SALES_EMAIL_SEND_GRAPH_ATTACHMENTS_TIMEOUT_MS ?? 60_000)
      : defaultTimeout)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  let res: Response
  try {
    res = await fetch(`https://graph.microsoft.com/v1.0/users/${userId}/sendMail`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Microsoft Graph sendMail timed out after ${timeout}ms.`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }

  const latencyMs = Math.max(0, Date.now() - startedAt)

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Microsoft Graph sendMail failed (${res.status}): ${body}`)
  }

  return {
    correlationId: id,
    latencyMs,
    httpStatus: res.status,
  }
}

/** @deprecated Prefer sendMailViaGraphWithResult for delivery logging. */
export async function sendMailViaGraph(options: GraphSendMailOptions): Promise<void> {
  await sendMailViaGraphWithResult(options)
}
