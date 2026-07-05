import type { SupabaseClient } from '@supabase/supabase-js'
import type { GraphMailMessage } from '@/lib/graph/graphMailClient'
import {
  normalizeInternetMessageId,
  parseCorrelationId,
  parseInReplyTo,
  parseSenderAddress,
} from '@/lib/graph/graphMailClient'
import { findSalesDeliveryContextByCorrelationId } from '@/lib/sales/repositories/salesEmailDeliveryLogRepository'
import { findSalesEmailMessageByInternetMessageId } from '@/lib/sales/repositories/salesEmailMessageRepository'
import {
  getSalesEmailThreadByCampaignContact,
  getSalesEmailThreadByGraphConversationId,
  listSalesEmailThreads,
} from '@/lib/sales/repositories/salesEmailThreadRepository'

export type InboundMatchReason =
  | 'x_nbe_correlation_id'
  | 'in_reply_to'
  | 'internet_message_id'
  | 'graph_conversation_id'
  | 'contact_email'
  | 'campaign'

export type InboundMessageMatch = {
  campaignId: string
  contactId: string
  businessId: string | null
  threadId: string | null
  generatedEmailId: string | null
  deliveryLogId: string | null
  matchReason: InboundMatchReason
}

async function resolveBusinessIdForCampaignContact(
  supabase: SupabaseClient,
  campaignId: string,
  contactId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('sales_campaign_contacts')
    .select('business_id')
    .eq('campaign_id', campaignId)
    .eq('contact_id', contactId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return String((data as { business_id: string }).business_id)
}

async function resolveCampaignForContact(
  supabase: SupabaseClient,
  contactId: string,
): Promise<{ campaignId: string; businessId: string | null } | null> {
  const threads = await listSalesEmailThreads(supabase, { contactId, limit: 1 })
  if (threads[0]) {
    return {
      campaignId: threads[0].campaign_id,
      businessId: threads[0].business_id,
    }
  }

  const { data: sentQueue, error: queueErr } = await supabase
    .from('sales_email_send_queue')
    .select('campaign_id')
    .eq('contact_id', contactId)
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (queueErr) throw queueErr
  if (sentQueue) {
    const campaignId = String((sentQueue as { campaign_id: string }).campaign_id)
    const businessId = await resolveBusinessIdForCampaignContact(supabase, campaignId, contactId)
    return { campaignId, businessId }
  }

  const { data: cc, error: ccErr } = await supabase
    .from('sales_campaign_contacts')
    .select('campaign_id, business_id')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (ccErr) throw ccErr
  if (!cc) return null

  return {
    campaignId: String((cc as { campaign_id: string }).campaign_id),
    businessId: String((cc as { business_id: string }).business_id),
  }
}

async function findContactIdByEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null

  const { data, error } = await supabase
    .from('sales_contacts')
    .select('id')
    .ilike('email', normalized)
    .order('is_primary', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return String((data as { id: string }).id)
}

export async function matchInboundGraphMessage(
  supabase: SupabaseClient,
  message: GraphMailMessage,
): Promise<InboundMessageMatch | null> {
  const correlationId = parseCorrelationId(message)
  if (correlationId) {
    const ctx = await findSalesDeliveryContextByCorrelationId(supabase, correlationId)
    if (ctx) {
      const businessId = await resolveBusinessIdForCampaignContact(
        supabase,
        ctx.campaignId,
        ctx.contactId,
      )
      const thread = await getSalesEmailThreadByCampaignContact(
        supabase,
        ctx.campaignId,
        ctx.contactId,
      )
      return {
        campaignId: ctx.campaignId,
        contactId: ctx.contactId,
        businessId,
        threadId: thread?.id ?? null,
        generatedEmailId: ctx.generatedEmailId,
        deliveryLogId: ctx.deliveryLogId,
        matchReason: 'x_nbe_correlation_id',
      }
    }
  }

  const inReplyTo = parseInReplyTo(message)
  if (inReplyTo) {
    const parent = await findSalesEmailMessageByInternetMessageId(supabase, inReplyTo)
    if (parent) {
      const { data: threadRow, error } = await supabase
        .from('sales_email_threads')
        .select('id, campaign_id, contact_id, business_id')
        .eq('id', parent.thread_id)
        .maybeSingle()
      if (error) throw error
      if (threadRow) {
        const t = threadRow as {
          id: string
          campaign_id: string
          contact_id: string
          business_id: string | null
        }
        return {
          campaignId: t.campaign_id,
          contactId: t.contact_id,
          businessId: t.business_id,
          threadId: t.id,
          generatedEmailId: parent.generated_email_id,
          deliveryLogId: parent.delivery_log_id,
          matchReason: 'in_reply_to',
        }
      }
    }
  }

  const internetId = normalizeInternetMessageId(message.internetMessageId)
  if (internetId) {
    const existing = await findSalesEmailMessageByInternetMessageId(supabase, internetId)
    if (existing) {
      const { data: threadRow, error } = await supabase
        .from('sales_email_threads')
        .select('id, campaign_id, contact_id, business_id')
        .eq('id', existing.thread_id)
        .maybeSingle()
      if (error) throw error
      if (threadRow) {
        const t = threadRow as {
          id: string
          campaign_id: string
          contact_id: string
          business_id: string | null
        }
        return {
          campaignId: t.campaign_id,
          contactId: t.contact_id,
          businessId: t.business_id,
          threadId: t.id,
          generatedEmailId: existing.generated_email_id,
          deliveryLogId: existing.delivery_log_id,
          matchReason: 'internet_message_id',
        }
      }
    }
  }

  const conversationId = message.conversationId?.trim()
  if (conversationId) {
    const thread = await getSalesEmailThreadByGraphConversationId(supabase, conversationId)
    if (thread) {
      return {
        campaignId: thread.campaign_id,
        contactId: thread.contact_id,
        businessId: thread.business_id,
        threadId: thread.id,
        generatedEmailId: null,
        deliveryLogId: null,
        matchReason: 'graph_conversation_id',
      }
    }

    const { data: priorMsg, error: priorErr } = await supabase
      .from('sales_email_messages')
      .select('thread_id, generated_email_id, delivery_log_id')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (priorErr) throw priorErr
    if (priorMsg) {
      const m = priorMsg as {
        thread_id: string
        generated_email_id: string | null
        delivery_log_id: string | null
      }
      const { data: threadRow, error } = await supabase
        .from('sales_email_threads')
        .select('id, campaign_id, contact_id, business_id')
        .eq('id', m.thread_id)
        .maybeSingle()
      if (error) throw error
      if (threadRow) {
        const t = threadRow as {
          id: string
          campaign_id: string
          contact_id: string
          business_id: string | null
        }
        return {
          campaignId: t.campaign_id,
          contactId: t.contact_id,
          businessId: t.business_id,
          threadId: t.id,
          generatedEmailId: m.generated_email_id,
          deliveryLogId: m.delivery_log_id,
          matchReason: 'graph_conversation_id',
        }
      }
    }
  }

  const sender = parseSenderAddress(message)
  if (sender) {
    const contactId = await findContactIdByEmail(supabase, sender)
    if (contactId) {
      const resolved = await resolveCampaignForContact(supabase, contactId)
      if (resolved) {
        const thread = await getSalesEmailThreadByCampaignContact(
          supabase,
          resolved.campaignId,
          contactId,
        )
        return {
          campaignId: resolved.campaignId,
          contactId,
          businessId: resolved.businessId,
          threadId: thread?.id ?? null,
          generatedEmailId: null,
          deliveryLogId: null,
          matchReason: 'contact_email',
        }
      }
    }
  }

  return null
}
