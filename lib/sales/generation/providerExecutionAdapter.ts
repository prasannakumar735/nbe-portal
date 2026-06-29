import { isLLMProviderId, type LLMProviderId } from '@/lib/sales/constants/llmProviders'
import {
  GenerationEmptyResponseError,
  GenerationInvalidPromptError,
  GenerationMalformedResponseError,
} from '@/lib/sales/generation/generationFailureClassifier'
import type { GeneratedEmailResult } from '@/lib/sales/llm/llmProvider.interface'
import { getLLMProvider } from '@/lib/sales/llm/llmProviderRegistry'

export type ProviderGenerationContent = {
  subject: string
  body: string
  provider: string
}

export type ProviderGenerationExecutionResult = {
  content: ProviderGenerationContent
  promptTokens: number
  completionTokens: number
  latencyMs: number
}

export type ExecuteProviderGenerationInput = {
  provider: string
  prompt: string
}

/** Rough token estimate until provider APIs return usage metadata (Phase 5+). */
export function estimateTokenCount(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return Math.max(1, Math.ceil(trimmed.length / 4))
}

function assertKnownProvider(provider: string): LLMProviderId {
  if (!isLLMProviderId(provider)) {
    throw new Error(`Unknown LLM provider: ${provider}`)
  }
  return provider
}

function normalizeProviderEmailResult(
  provider: LLMProviderId,
  raw: GeneratedEmailResult,
): ProviderGenerationContent {
  const subject = typeof raw.subject === 'string' ? raw.subject.trim() : ''
  const body = typeof raw.body === 'string' ? raw.body.trim() : ''
  const resolvedProvider =
    typeof raw.provider === 'string' && raw.provider.trim() ? raw.provider.trim() : provider

  if (!subject && !body) {
    throw new GenerationEmptyResponseError()
  }

  if (!subject || !body) {
    throw new GenerationMalformedResponseError(
      !subject ? 'LLM response missing subject.' : 'LLM response missing body.',
    )
  }

  return {
    subject,
    body,
    provider: resolvedProvider,
  }
}

/**
 * Provider-agnostic execution entry point for email generation (all registered LLM providers).
 */
export async function executeProviderGeneration(
  input: ExecuteProviderGenerationInput,
): Promise<ProviderGenerationExecutionResult> {
  const provider = assertKnownProvider(input.provider)
  const prompt = input.prompt.trim()

  if (!prompt) {
    throw new GenerationInvalidPromptError('Generation prompt is empty.')
  }

  const startedAt = Date.now()
  const llm = getLLMProvider(provider)
  const raw = await llm.generateEmail(prompt)
  const latencyMs = Math.max(0, Date.now() - startedAt)

  const content = normalizeProviderEmailResult(provider, raw)
  const completionText = `${content.subject}\n\n${content.body}`

  return {
    content,
    promptTokens: estimateTokenCount(prompt),
    completionTokens: estimateTokenCount(completionText),
    latencyMs,
  }
}
