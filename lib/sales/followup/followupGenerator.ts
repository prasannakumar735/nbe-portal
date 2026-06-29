import type { SupabaseClient } from '@supabase/supabase-js'
import { isLLMProviderId, type LLMProviderId } from '@/lib/sales/constants/llmProviders'
import {
  executeProviderGeneration,
  type ProviderGenerationExecutionResult,
} from '@/lib/sales/generation/providerExecutionAdapter'
import {
  loadEmailGenerationPromptContext,
  type EmailGenerationPromptContext,
} from '@/lib/sales/generation/emailPromptBuilder'
import { getLLMProvider } from '@/lib/sales/llm/llmProviderRegistry'
import type { SalesBusiness } from '@/lib/sales/types/business.types'
import type { SalesCampaign } from '@/lib/sales/types/campaign.types'
import type { SalesContact } from '@/lib/sales/types/contact.types'
import type { SalesGeneratedEmail } from '@/lib/sales/types/generatedEmail.types'

export type FollowupCampaignContext = EmailGenerationPromptContext

export type FollowupPromptInput = {
  originalEmail: Pick<SalesGeneratedEmail, 'subject' | 'body'>
  context: FollowupCampaignContext
  followupNumber: number
  provider: LLMProviderId
  /** When set, prompt must not imply a reply was received. */
  lastReplyAt?: string | null
}

export type BuildFollowupGenerationPromptInput = {
  originalEmail: Pick<SalesGeneratedEmail, 'subject' | 'body'>
  campaign: SalesCampaign
  contact: SalesContact
  business: SalesBusiness
  followupNumber: number
  provider: LLMProviderId
  lastReplyAt?: string | null
}

export type FollowupEmailGenerationInput = {
  provider: LLMProviderId
  prompt: string
}

export type FollowupEmailGenerationResult = ProviderGenerationExecutionResult & {
  resolvedProvider: string
}

function formatList(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : '- (none specified)'
}

function followupStrategyLine(followupNumber: number): string {
  if (followupNumber <= 1) {
    return 'Follow-up 1: Gentle reminder — reference the prior message professionally without pressure.'
  }
  if (followupNumber === 2) {
    return 'Follow-up 2: Reinforce the value proposition and how it applies to their business; stay concise.'
  }
  return 'Follow-up 3: Final courteous check-in — acknowledge they may be busy; offer an easy next step or close the loop politely.'
}

function buildRecipientBlock(context: FollowupCampaignContext): string {
  const { contact, business } = context
  return [
    `Company: ${business.company_name}`,
    `Location: ${[business.suburb, business.postcode].filter(Boolean).join(', ') || business.postcode}`,
    `Industry/category: ${business.category ?? 'unknown'}`,
    `Website: ${business.website ?? 'unknown'}`,
    `Contact email: ${contact.email ?? 'unknown'}`,
    `Contact type: ${contact.contact_type}`,
    `Primary contact: ${contact.is_primary ? 'yes' : 'no'}`,
  ].join('\n')
}

export function resolveFollowupProvider(raw: string): LLMProviderId {
  if (!isLLMProviderId(raw)) {
    throw new Error(`Unknown LLM provider for follow-up: ${raw}`)
  }
  getLLMProvider(raw)
  return raw
}

/**
 * Build LLM prompt for a sequence follow-up (reuses campaign template + contact context).
 */
export function generateFollowupPrompt(input: FollowupPromptInput): string {
  const { originalEmail, context, followupNumber, provider, lastReplyAt } = input
  const { campaign, promptConfig, template, campaignTypeName, offerTypeName } = context

  const replyGuard =
    lastReplyAt != null
      ? 'A reply timestamp exists on record — do not write as if you are following up on silence.'
      : 'Do not claim you received a reply unless one exists.'

  return [
    'You are writing a follow-up B2B sales email in an existing outreach thread.',
    '',
    '## Campaign',
    `Name: ${campaign.name}`,
    `Product/service focus: ${campaignTypeName}`,
    `Offer: ${offerTypeName}`,
    '',
    '## Template (stay aligned with original outreach)',
    `Template name: ${template.template_name}`,
    `Objective: ${promptConfig.objective}`,
    `Tone: ${promptConfig.tone}`,
    `Call to action: ${promptConfig.cta}`,
    '',
    '## Pain points to address',
    formatList(promptConfig.pain_points),
    '',
    '## Target roles',
    formatList(promptConfig.target_roles),
    '',
    '## Avoid',
    formatList(promptConfig.avoid),
    '',
    '## Recipient / company context',
    buildRecipientBlock(context),
    '',
    '## Prior outreach (do not repeat verbatim; build on it)',
    `Subject: ${originalEmail.subject}`,
    '',
    originalEmail.body,
    '',
    '## Follow-up strategy',
    followupStrategyLine(followupNumber),
    `This is follow-up number ${followupNumber} in the sequence.`,
    '',
    '## Generation',
    `LLM provider: ${provider}`,
    '',
    '## Output format',
    'Return a concise subject line (may be a light variation of the original) and email body suitable for a warehouse/industrial decision-maker.',
    'Do not use spammy urgency language.',
    replyGuard,
  ].join('\n')
}

export async function buildFollowupGenerationPrompt(
  supabase: SupabaseClient,
  input: BuildFollowupGenerationPromptInput,
): Promise<{ prompt: string; provider: LLMProviderId; context: FollowupCampaignContext }> {
  const provider = resolveFollowupProvider(input.provider)
  const context = await loadEmailGenerationPromptContext(supabase, {
    campaign: input.campaign,
    contact: input.contact,
    business: input.business,
  })
  const prompt = generateFollowupPrompt({
    originalEmail: input.originalEmail,
    context,
    followupNumber: input.followupNumber,
    provider,
    lastReplyAt: input.lastReplyAt,
  })
  return { prompt, provider, context }
}

/**
 * Execute follow-up generation via the shared provider adapter (no parallel LLM stack).
 */
export async function generateFollowupEmailContent(
  input: FollowupEmailGenerationInput,
): Promise<FollowupEmailGenerationResult> {
  const provider = resolveFollowupProvider(input.provider)
  const execution = await executeProviderGeneration({ provider, prompt: input.prompt })
  return {
    ...execution,
    resolvedProvider: execution.content.provider || provider,
  }
}
