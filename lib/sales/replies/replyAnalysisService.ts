import type { SupabaseClient } from '@supabase/supabase-js'
import type { LLMProviderId } from '@/lib/sales/constants/llmProviders'
import { resolveDefaultSalesLlmProvider } from '@/lib/sales/constants/llmProviders'
import {
  getLatestSalesReplyAnalysisByMessageId,
  getNextSalesReplyAnalysisVersion,
  insertSalesReplyAnalysis,
} from '@/lib/sales/repositories/salesReplyAnalysisRepository'
import { runChatCompletion } from '@/lib/sales/llm/runChatCompletion'
import {
  buildReplyAnalysisSystemPrompt,
  buildReplyAnalysisUserPrompt,
  loadReplyAnalysisContext,
} from '@/lib/sales/replies/replyAnalysisContext'
import {
  parseReplyAnalysisModelOutput,
  toStoredReplyAnalysisFields,
} from '@/lib/sales/replies/parseReplyAnalysisResponse'
import { createReplyAnalysisNotifications } from '@/lib/sales/replies/replyNotificationService'
import type { SalesReplyAnalysis } from '@/lib/sales/types/replyManagement.types'

export type RunReplyAnalysisInput = {
  threadId: string
  messageId?: string
  provider?: string | null
  /** When false, skip if a completed analysis already exists for the message. */
  forceNewVersion?: boolean
}

export type RunReplyAnalysisResult = {
  analysis: SalesReplyAnalysis
  created: boolean
  skippedDuplicate: boolean
  provider: LLMProviderId
  latencyMs: number
}

function resolveModelName(provider: LLMProviderId): string {
  if (provider === 'groq') {
    return process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile'
  }
  return process.env.XAI_MODEL?.trim() || 'grok-4.3'
}

function logReplyAnalysisFailure(messageId: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error)
  console.error(`[sales-reply-analysis] message=${messageId} failed: ${detail}`)
}

async function persistFailedAnalysis(
  supabase: SupabaseClient,
  input: {
    messageId: string
    analysisVersion: number
    modelName: string | null
    promptVersion: number | null
    errorMessage: string
  },
): Promise<SalesReplyAnalysis> {
  return insertSalesReplyAnalysis(supabase, {
    message_id: input.messageId,
    analysis_version: input.analysisVersion,
    model_name: input.modelName,
    prompt_version: input.promptVersion,
    summary: null,
    sentiment: null,
    buying_intent: null,
    categories: [],
    urgency: null,
    suggested_next_action: input.errorMessage.slice(0, 2000),
    confidence: null,
    analysis_status: 'failed',
  })
}

export async function runReplyAnalysis(
  supabase: SupabaseClient,
  input: RunReplyAnalysisInput,
): Promise<RunReplyAnalysisResult> {
  const ctx = await loadReplyAnalysisContext(supabase, {
    threadId: input.threadId,
    messageId: input.messageId,
  })

  const messageId = ctx.inboundMessage.id
  const latest = await getLatestSalesReplyAnalysisByMessageId(supabase, messageId)

  if (!input.forceNewVersion && latest?.analysis_status === 'completed') {
    return {
      analysis: latest,
      created: false,
      skippedDuplicate: true,
      provider: resolveDefaultSalesLlmProvider(),
      latencyMs: 0,
    }
  }

  const analysisVersion = await getNextSalesReplyAnalysisVersion(supabase, messageId)
  const promptVersion = ctx.promptBundle.promptVersion
  let provider: LLMProviderId = 'groq'
  let latencyMs = 0
  let modelName: string | null = null

  try {
    const completion = await runChatCompletion({
      provider: input.provider,
      systemPrompt: buildReplyAnalysisSystemPrompt(),
      userPrompt: buildReplyAnalysisUserPrompt(ctx),
      maxTokens: 1200,
    })
    provider = completion.provider
    latencyMs = completion.latencyMs
    modelName = resolveModelName(provider)

    const parsed = parseReplyAnalysisModelOutput(completion.content)
    const stored = toStoredReplyAnalysisFields(parsed)

    const analysis = await insertSalesReplyAnalysis(supabase, {
      message_id: messageId,
      analysis_version: analysisVersion,
      model_name: modelName,
      prompt_version: promptVersion,
      summary: stored.summary,
      sentiment: stored.sentiment,
      buying_intent: stored.buying_intent,
      categories: stored.categories,
      urgency: stored.urgency,
      suggested_next_action: stored.suggested_next_action,
      confidence: stored.confidence,
      analysis_status: 'completed',
    })

    await createReplyAnalysisNotifications(supabase, {
      threadId: ctx.thread.id,
      messageId,
      categories: stored.categories,
      urgency: stored.urgency,
      analysisStatus: 'completed',
    })

    return {
      analysis,
      created: true,
      skippedDuplicate: false,
      provider,
      latencyMs,
    }
  } catch (error) {
    logReplyAnalysisFailure(messageId, error)
    modelName = modelName ?? resolveModelName(provider)

    const failed = await persistFailedAnalysis(supabase, {
      messageId,
      analysisVersion,
      modelName,
      promptVersion,
      errorMessage: error instanceof Error ? error.message : 'Analysis failed',
    })

    await createReplyAnalysisNotifications(supabase, {
      threadId: ctx.thread.id,
      messageId,
      categories: [],
      urgency: 'low',
      analysisStatus: 'failed',
    })

    return {
      analysis: failed,
      created: true,
      skippedDuplicate: false,
      provider,
      latencyMs,
    }
  }
}
