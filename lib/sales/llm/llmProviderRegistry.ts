import {
  isLLMProviderId,
  type LLMProviderId,
} from '@/lib/sales/constants/llmProviders'
import { anthropicProvider } from '@/lib/sales/llm/anthropicProvider'
import { groqProvider } from '@/lib/sales/llm/groqProvider'
import type { LLMProvider } from '@/lib/sales/llm/llmProvider.interface'
import { ollamaProvider } from '@/lib/sales/llm/ollamaProvider'
import { openaiProvider } from '@/lib/sales/llm/openaiProvider'

const providers: Record<LLMProviderId, LLMProvider> = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  ollama: ollamaProvider,
  groq: groqProvider,
}

export function getLLMProvider(providerId: string): LLMProvider {
  if (!isLLMProviderId(providerId)) {
    throw new Error(`Unknown LLM provider: ${providerId}`)
  }
  return providers[providerId]
}

export function listRegisteredLLMProviderIds(): LLMProviderId[] {
  return Object.keys(providers) as LLMProviderId[]
}
