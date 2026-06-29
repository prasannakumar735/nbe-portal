/** Registered LLM provider keys (Phase 4.6 registry; extend without schema change). */

export const LLM_PROVIDER_IDS = ['openai', 'anthropic', 'ollama', 'groq'] as const

export type LLMProviderId = (typeof LLM_PROVIDER_IDS)[number]

export function isLLMProviderId(value: string): value is LLMProviderId {
  return (LLM_PROVIDER_IDS as readonly string[]).includes(value)
}
