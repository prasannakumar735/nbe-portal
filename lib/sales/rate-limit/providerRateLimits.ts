import type { LLMProviderId } from '@/lib/sales/constants/llmProviders'

/** Max LLM requests per provider per rolling minute (Sales Engine only). */
export const PROVIDER_RATE_LIMITS: Record<LLMProviderId, { requestsPerMinute: number }> = {
  openai: { requestsPerMinute: 20 },
  anthropic: { requestsPerMinute: 15 },
  groq: { requestsPerMinute: 30 },
  ollama: { requestsPerMinute: 10 },
}

export const PROVIDER_RATE_LIMIT_WINDOW_MS = 60_000
