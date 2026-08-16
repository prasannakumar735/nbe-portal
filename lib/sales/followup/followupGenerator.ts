import type { SupabaseClient } from '@supabase/supabase-js'
import { isLLMProviderId, type LLMProviderId } from '@/lib/sales/constants/llmProviders'
import {
  executeProviderGeneration,
  type ProviderGenerationExecutionResult,
} from '@/lib/sales/generation/providerExecutionAdapter'
import {
  buildEmailGenerationPromptBundle,
  type EmailGenerationPromptBundle,
} from '@/lib/sales/generation/emailPromptBuilder'
import { getLLMProvider } from '@/lib/sales/llm/llmProviderRegistry'
import {
  formatThreadContextBlock,
  listThreadEmailsForFollowup,
} from '@/lib/sales/followup/followupThreadContext'
import type { SalesBusiness } from '@/lib/sales/types/business.types'
import type { SalesCampaign } from '@/lib/sales/types/campaign.types'
import type { SalesContact } from '@/lib/sales/types/contact.types'
import type { SalesGeneratedEmail } from '@/lib/sales/types/generatedEmail.types'

export type BuildFollowupGenerationPromptInput = {
  originalEmail: Pick<
    SalesGeneratedEmail,
    'id' | 'subject' | 'body' | 'thread_root_email_id' | 'sequence_position'
  >
  campaign: SalesCampaign
  contact: SalesContact
  business: SalesBusiness
  followupNumber: number
  provider: LLMProviderId
  lastReplyAt?: string | null
}

export type FollowupEmailGenerationInput = {
  provider: LLMProviderId
  systemPrompt: string
  userPrompt: string
}

export type FollowupEmailGenerationResult = ProviderGenerationExecutionResult & {
  resolvedProvider: string
  promptBundle: EmailGenerationPromptBundle
}

function followupStrategyLine(followupNumber: number): string {
  if (followupNumber <= 1) {
    return 'Follow-up 1: Polite reminder referencing the earlier message; no pressure.'
  }
  if (followupNumber === 2) {
    return 'Follow-up 2: Add one fresh operational angle; do not reuse prior phrasing.'
  }
  return 'Follow-up 3: Final courteous check-in; acknowledge they may be busy; easy opt-out tone.'
}

export function resolveFollowupProvider(raw: string): LLMProviderId {
  if (!isLLMProviderId(raw)) {
    throw new Error(`Unknown LLM provider for follow-up: ${raw}`)
  }
  getLLMProvider(raw)
  return raw
}

async function resolveFollowUpLibraryBundle(
  supabase: SupabaseClient,
  input: BuildFollowupGenerationPromptInput,
): Promise<EmailGenerationPromptBundle> {
  try {
    return await buildEmailGenerationPromptBundle(supabase, {
      campaign: input.campaign,
      contact: input.contact,
      business: input.business,
      useCaseSlug: 'follow_up',
    })
  } catch {
    return buildEmailGenerationPromptBundle(supabase, {
      campaign: input.campaign,
      contact: input.contact,
      business: input.business,
      useCaseSlug: 'initial_outreach',
    })
  }
}

export async function buildFollowupGenerationPromptBundle(
  supabase: SupabaseClient,
  input: BuildFollowupGenerationPromptInput,
): Promise<{ bundle: EmailGenerationPromptBundle; systemPrompt: string; userPrompt: string }> {
  resolveFollowupProvider(input.provider)
  const threadRoot = input.originalEmail.thread_root_email_id ?? input.originalEmail.id
  const threadEmails = await listThreadEmailsForFollowup(supabase, {
    campaignId: input.campaign.id,
    contactId: input.contact.id,
    threadRootEmailId: threadRoot,
  })

  const libraryBundle = await resolveFollowUpLibraryBundle(supabase, input)

  const replyGuard =
    input.lastReplyAt != null
      ? 'A reply is on record — do not write as if the thread is unanswered.'
      : 'No reply detected — write a respectful no-reply follow-up only.'

  const userPrompt = [
    libraryBundle.userPrompt,
    '',
    formatThreadContextBlock(threadEmails),
    '',
    '## Follow-up instructions',
    followupStrategyLine(input.followupNumber),
    'Sequence step: follow-up ' + input.followupNumber + ' of maximum 3.',
    replyGuard,
    'Do not repeat wording from thread history. Vary sentence structure and subject line.',
    'Return JSON only: {"subject":"...","body":"..."}.',
  ].join('\n')

  return {
    bundle: libraryBundle,
    systemPrompt: [
      libraryBundle.systemPrompt,
      'You are drafting a follow-up in an existing B2B outreach thread for NBE Australia.',
      'Professional Australian English only.',
    ].join('\n\n'),
    userPrompt,
  }
}

export async function generateFollowupEmailContent(
  input: FollowupEmailGenerationInput,
): Promise<Omit<FollowupEmailGenerationResult, 'promptBundle'>> {
  const provider = resolveFollowupProvider(input.provider)
  const execution = await executeProviderGeneration({
    provider,
    prompt: input.userPrompt,
    systemPrompt: input.systemPrompt,
  })
  return {
    ...execution,
    resolvedProvider: execution.content.provider || provider,
  }
}
