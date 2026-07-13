import type { SupabaseClient } from '@supabase/supabase-js'
import { SALES_ASSISTANT_DISCLAIMER } from '@/lib/sales/constants/assistantCapabilities'
import {
  buildSalesAssistantSystemPrompt,
  buildSalesAssistantUserPrompt,
} from '@/lib/sales/assistant/salesAssistantPrompts'
import { loadSalesAssistantContext } from '@/lib/sales/assistant/salesAssistantContext'
import { parseSalesAssistantModelOutput } from '@/lib/sales/assistant/parseAssistantResponse'
import { runChatCompletion } from '@/lib/sales/llm/runChatCompletion'
import type {
  SalesAssistantRunInput,
  SalesAssistantRunResult,
} from '@/lib/sales/types/salesAssistant.types'

export async function runSalesAssistant(
  supabase: SupabaseClient,
  input: SalesAssistantRunInput,
): Promise<SalesAssistantRunResult> {
  const business = await loadSalesAssistantContext(supabase, {
    businessId: input.businessId,
    contactId: input.contactId,
    campaignId: input.campaignId,
    opportunityId: input.opportunityId,
  })

  if (!business.business) {
    throw new Error('Business not found.')
  }

  const systemPrompt = buildSalesAssistantSystemPrompt()
  const userPrompt = buildSalesAssistantUserPrompt({
    capability: input.capability,
    context: business,
    replyText: input.replyText,
    managerNotes: input.managerNotes,
  })

  const completion = await runChatCompletion({
    provider: input.provider,
    systemPrompt,
    userPrompt,
    maxTokens: 2000,
  })

  const result = parseSalesAssistantModelOutput(completion.content)

  return {
    capability: input.capability,
    provider: completion.provider,
    latencyMs: completion.latencyMs,
    disclaimer: SALES_ASSISTANT_DISCLAIMER,
    context: business,
    result,
    rawModelText: completion.content,
  }
}
