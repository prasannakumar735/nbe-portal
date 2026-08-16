import type { SupabaseClient } from '@supabase/supabase-js'
import type { GraphMailMessage } from '@/lib/graph/graphMailClient'
import {
  normalizeInternetMessageId,
  parseInReplyTo,
  parseRecipientAddresses,
  parseSenderAddress,
} from '@/lib/graph/graphMailClient'
import type { InboundMessageMatch } from '@/lib/sales/replies/inboundMessageMatcher'
import { getSalesEmailMessageByGraphMessageId, insertSalesEmailMessage } from '@/lib/sales/repositories/salesEmailMessageRepository'
import {
  createSalesEmailThread,
  getSalesEmailThreadById,
  updateSalesEmailThread,
} from '@/lib/sales/repositories/salesEmailThreadRepository'

export type InboundImportResult =
  | { outcome: 'duplicate'; graphMessageId: string }
  | { outcome: 'imported'; graphMessageId: string; threadId: string; messageId: string; threadCreated: boolean }
  | { outcome: 'skipped'; reason: string; graphMessageId?: string }

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractBodies(message: GraphMailMessage): { bodyHtml: string | null; bodyText: string | null } {
  const content = message.body?.content ?? ''
  const type = message.body?.contentType?.toLowerCase() ?? 'text'
  if (!content.trim()) {
    return { bodyHtml: null, bodyText: null }
  }
  if (type === 'html') {
    return { bodyHtml: content, bodyText: htmlToPlainText(content) || null }
  }
  return { bodyHtml: null, bodyText: content }
}

function isFromSharedMailbox(sender: string | null): boolean {
  const from = process.env.MS_GRAPH_MAIL_FROM_ADDRESS?.trim().toLowerCase()
  if (!from || !sender) return false
  return sender === from
}

export async function importInboundGraphMessage(
  supabase: SupabaseClient,
  message: GraphMailMessage,
  match: InboundMessageMatch,
  _options?: { mailboxUserId?: string },
): Promise<InboundImportResult> {
  const graphMessageId = message.id?.trim()
  if (!graphMessageId) {
    return { outcome: 'skipped', reason: 'missing_graph_message_id' }
  }

  if (message['@removed']) {
    return { outcome: 'skipped', reason: 'removed', graphMessageId }
  }

  const existing = await getSalesEmailMessageByGraphMessageId(supabase, graphMessageId)
  if (existing) {
    return { outcome: 'duplicate', graphMessageId }
  }

  const sender = parseSenderAddress(message)
  if (isFromSharedMailbox(sender)) {
    return { outcome: 'skipped', reason: 'from_shared_mailbox', graphMessageId }
  }
  if (!sender) {
    return { outcome: 'skipped', reason: 'missing_sender', graphMessageId }
  }

  const receivedAt = message.receivedDateTime?.trim()
  if (!receivedAt) {
    return { outcome: 'skipped', reason: 'missing_received_at', graphMessageId }
  }

  let threadId = match.threadId
  let threadCreated = false

  if (threadId) {
    const thread = await getSalesEmailThreadById(supabase, threadId)
    if (!thread) {
      threadId = null
    } else if (
      message.conversationId?.trim() &&
      !thread.graph_conversation_id
    ) {
      await updateSalesEmailThread(supabase, thread.id, {
        graph_conversation_id: message.conversationId.trim(),
      })
    }
  }

  if (!threadId) {
    const created = await createSalesEmailThread(supabase, {
      campaign_id: match.campaignId,
      contact_id: match.contactId,
      business_id: match.businessId,
      graph_conversation_id: message.conversationId?.trim() ?? null,
      status: 'open',
    })
    threadId = created.id
    threadCreated = true
  }

  const { bodyHtml, bodyText } = extractBodies(message)
  const inserted = await insertSalesEmailMessage(supabase, {
    thread_id: threadId,
    direction: 'inbound',
    generated_email_id: match.generatedEmailId,
    delivery_log_id: match.deliveryLogId,
    graph_message_id: graphMessageId,
    internet_message_id: normalizeInternetMessageId(message.internetMessageId),
    conversation_id: message.conversationId?.trim() ?? null,
    in_reply_to: parseInReplyTo(message),
    sender,
    recipients: parseRecipientAddresses(message),
    subject: message.subject?.trim() || '(no subject)',
    body_html: bodyHtml,
    body_text: bodyText,
    received_at: receivedAt,
    import_source: 'graph_delta',
  })

  if (!inserted) {
    return { outcome: 'duplicate', graphMessageId }
  }

  await updateSalesEmailThread(supabase, threadId, {})

  return {
    outcome: 'imported',
    graphMessageId,
    threadId,
    messageId: inserted.id,
    threadCreated,
  }
}
