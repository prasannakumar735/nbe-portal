/** Registered LLM provider keys (Phase 4.6 registry; extend without schema change). */

export const LLM_PROVIDER_IDS = ['openai', 'anthropic', 'ollama', 'groq', 'xai'] as const

export type LLMProviderId = (typeof LLM_PROVIDER_IDS)[number]

export function isLLMProviderId(value: string): value is LLMProviderId {
  return (LLM_PROVIDER_IDS as readonly string[]).includes(value)
}

/** Local dev default: `SALES_LLM_PROVIDER`, else xAI / Groq when API keys are set, else ollama. */
export function resolveDefaultSalesLlmProvider(): LLMProviderId {
  const fromEnv = process.env.SALES_LLM_PROVIDER?.trim().toLowerCase()
  if (fromEnv && isLLMProviderId(fromEnv)) {
    return fromEnv
  }
  if (process.env.XAI_API_KEY?.trim()) {
    return 'xai'
  }
  if (process.env.GROQ_API_KEY?.trim()) {
    return 'groq'
  }
  return 'ollama'
}
