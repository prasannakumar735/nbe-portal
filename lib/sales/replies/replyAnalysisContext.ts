import type { SupabaseClient } from '@supabase/supabase-js'
import type { EmailGenerationPromptBundle } from '@/lib/sales/generation/emailPromptBuilder'
import { buildEmailGenerationPromptBundle } from '@/lib/sales/generation/emailPromptBuilder'
import {
  formatNbeFrameworkUserSections,
  NBE_TECHNICAL_ACCURACY_RULES,
} from '@/lib/sales/prompts/nbeB2bSalesEmailFramework'
import { SALES_INDUSTRY_LABELS } from '@/lib/sales/constants/industrySlugs'
import { SALES_PRODUCT_LINE_LABELS } from '@/lib/sales/constants/productLineSlugs'
import type { SalesProductLineSlug } from '@/lib/sales/constants/productLineSlugs'
import type { SalesIndustrySlug } from '@/lib/sales/constants/industrySlugs'
import { getSalesBusinessById } from '@/lib/sales/repositories/salesBusinessRepository'
import { getSalesCampaignById } from '@/lib/sales/repositories/salesCampaignRepository'
import { listSalesContactsByIds } from '@/lib/sales/repositories/salesContactRepository'
import { getSalesGeneratedEmailById } from '@/lib/sales/repositories/salesGeneratedEmailRepository'
import {
  getSalesEmailThreadById,
} from '@/lib/sales/repositories/salesEmailThreadRepository'
import { listSalesEmailMessagesByThreadId } from '@/lib/sales/repositories/salesEmailMessageRepository'
import type { SalesEmailMessage, SalesEmailThread } from '@/lib/sales/types/replyManagement.types'
import type { SalesGeneratedEmail } from '@/lib/sales/types/generatedEmail.types'
import type { SalesCampaign } from '@/lib/sales/types/campaign.types'
import type { SalesContact } from '@/lib/sales/types/contact.types'
import type { SalesBusiness } from '@/lib/sales/types/business.types'

export const REPLY_ANALYSIS_MAX_THREAD_MESSAGES = 10
const MESSAGE_BODY_MAX_CHARS = 4_000

export type ReplyAnalysisConversationContext = {
  thread: SalesEmailThread
  campaign: SalesCampaign
  contact: SalesContact
  business: SalesBusiness | null
  promptBundle: EmailGenerationPromptBundle
  threadMessages: SalesEmailMessage[]
  inboundMessage: SalesEmailMessage
  originalOutbound: SalesGeneratedEmail | null
}

function truncateText(value: string | null | undefined, max: number): string {
  if (!value?.trim()) return ''
  const t = value.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

export async function loadReplyAnalysisContext(
  supabase: SupabaseClient,
  input: { threadId: string; messageId?: string },
): Promise<ReplyAnalysisConversationContext> {
  const thread = await getSalesEmailThreadById(supabase, input.threadId)
  if (!thread) {
    throw new Error('Thread not found.')
  }

  const [campaign, contacts, business] = await Promise.all([
    getSalesCampaignById(supabase, thread.campaign_id),
    listSalesContactsByIds(supabase, [thread.contact_id]),
    thread.business_id
      ? getSalesBusinessById(supabase, thread.business_id)
      : Promise.resolve(null),
  ])

  if (!campaign) {
    throw new Error('Campaign not found for thread.')
  }

  const contact = contacts[0]
  if (!contact) {
    throw new Error('Contact not found for thread.')
  }

  let businessRow = business
  if (!businessRow && contact.business_id) {
    businessRow = await getSalesBusinessById(supabase, contact.business_id)
  }
  if (!businessRow) {
    throw new Error('Business not found for thread.')
  }

  const allMessages = await listSalesEmailMessagesByThreadId(supabase, thread.id)
  const threadMessages = allMessages.slice(-REPLY_ANALYSIS_MAX_THREAD_MESSAGES)

  let inboundMessage: SalesEmailMessage | undefined
  if (input.messageId) {
    inboundMessage = allMessages.find((m) => m.id === input.messageId)
    if (!inboundMessage || inboundMessage.direction !== 'inbound') {
      throw new Error('Inbound message not found on thread.')
    }
  } else {
    const inbounds = allMessages.filter((m) => m.direction === 'inbound')
    inboundMessage = inbounds[inbounds.length - 1]
    if (!inboundMessage) {
      throw new Error('No inbound message to analyse on this thread.')
    }
  }

  const promptBundle = await buildEmailGenerationPromptBundle(supabase, {
    campaign,
    contact,
    business: businessRow,
  })

  const outboundMsg = [...threadMessages].reverse().find(
    (m) => m.direction === 'outbound' && m.generated_email_id,
  )
  const originalOutbound = outboundMsg?.generated_email_id
    ? await getSalesGeneratedEmailById(supabase, outboundMsg.generated_email_id)
    : null

  return {
    thread,
    campaign,
    contact,
    business: businessRow,
    promptBundle,
    threadMessages,
    inboundMessage,
    originalOutbound,
  }
}

export function buildReplyAnalysisSystemPrompt(): string {
  return [
    'You analyse inbound B2B customer email replies for NBE Australia sales managers.',
    'Provide structured business intelligence and recommended next actions for internal use only.',
    'Never write, draft, or suggest exact customer-facing reply text.',
    'Respond with exactly one JSON object matching the schema in the user message.',
    'No markdown code fences and no text outside the JSON object.',
    '',
    'NBE context: consultative Australian industrial B2B sales (warehouse, manufacturing, logistics).',
    ...NBE_TECHNICAL_ACCURACY_RULES.map((r) => `- ${r}`),
  ].join('\n')
}

export function buildReplyAnalysisUserPrompt(ctx: ReplyAnalysisConversationContext): string {
  const productSlug = (ctx.promptBundle.product_slug ?? 'general') as SalesProductLineSlug
  const industrySlug = (ctx.promptBundle.industry_slug ?? 'general') as SalesIndustrySlug
  const productLabel =
    SALES_PRODUCT_LINE_LABELS[productSlug] ?? ctx.promptBundle.product_slug ?? 'General'
  const industryLabel =
    SALES_INDUSTRY_LABELS[industrySlug] ?? ctx.promptBundle.industry_slug ?? 'General'

  const libraryLines = [
    `Prompt library: ${ctx.promptBundle.promptName} (v${ctx.promptBundle.promptVersion})`,
    ctx.promptBundle.promptDescription?.trim()
      ? `Description: ${ctx.promptBundle.promptDescription.trim()}`
      : null,
  ].filter(Boolean)

  const originalOutboundBlock = ctx.originalOutbound
    ? [
        '## Original outbound email (sent to customer)',
        `Subject: ${ctx.originalOutbound.subject}`,
        truncateText(ctx.originalOutbound.body, MESSAGE_BODY_MAX_CHARS),
      ].join('\n')
    : '## Original outbound email\n(not available in thread)'

  const history = ctx.threadMessages
    .map((m) => {
      const body = truncateText(m.body_text ?? m.body_html, MESSAGE_BODY_MAX_CHARS)
      return [
        `--- ${m.direction.toUpperCase()} (${m.received_at ?? m.created_at}) ---`,
        `From: ${m.sender ?? 'unknown'}`,
        `Subject: ${m.subject}`,
        body || '(empty body)',
      ].join('\n')
    })
    .join('\n\n')

  const latestBody = truncateText(
    ctx.inboundMessage.body_text ?? ctx.inboundMessage.body_html,
    MESSAGE_BODY_MAX_CHARS,
  )

  const categoryList = [
    'Interested',
    'Needs Quote',
    'Wants Site Inspection',
    'Technical Question',
    'Pricing Question',
    'Existing Customer',
    'Not Interested',
    'Wrong Contact',
    'Unsubscribe',
  ].join(', ')

  return [
    'Analyse the latest inbound customer reply using the conversation below.',
    'Do not write a reply email.',
    '',
    '## Campaign',
    `Name: ${ctx.campaign.name}`,
    `Contact email: ${ctx.contact.email ?? 'unknown'}`,
    `Business: ${ctx.business?.company_name ?? 'unknown'}`,
    `Product line: ${productLabel}`,
    `Industry: ${industryLabel}`,
    ...libraryLines,
    '',
    formatNbeFrameworkUserSections({ productSlug, industrySlug }),
    '',
    originalOutboundBlock,
    '',
    `## Conversation (up to ${REPLY_ANALYSIS_MAX_THREAD_MESSAGES} messages, oldest first)`,
    history,
    '',
    '## Latest inbound message (focus analysis here)',
    `Subject: ${ctx.inboundMessage.subject}`,
    latestBody || '(empty body)',
    '',
    '## Required JSON schema (return only this object)',
    JSON.stringify(
      {
        summary: 'string — concise manager-facing summary',
        sentiment: 'positive | neutral | negative',
        buying_intent: 'high | medium | low | none',
        categories: [`one or more of: ${categoryList}`],
        urgency: 'high | medium | low',
        suggested_next_action: 'string — internal next step, not customer reply text',
        confidence: 0.0,
      },
      null,
      2,
    ),
  ].join('\n')
}
